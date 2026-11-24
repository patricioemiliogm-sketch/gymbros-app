// =====================================================================
// GYM BROS · Servidor en Cloudflare Workers + base de datos D1
// - /api/*  → API de la app (login, socios, clases, check-in, rutinas)
// - /setup  → página para crear los administradores base
// - todo lo demás → la app web (carpeta dist/, servida por Cloudflare)
// =====================================================================

// ---------- Tipos mínimos de Cloudflare (sin dependencias) ----------
interface D1Result<T> { results: T[] }
interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(sql: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown>;
}
interface Fetcher { fetch(req: Request): Promise<Response> }

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  JWT_SECRET: string;
  SETUP_KEY?: string;
}

type Role = 'admin' | 'member';
type Status = 'pending' | 'active' | 'inactive';
type UserRow = {
  id: string; email: string; password_hash: string; full_name: string; phone: string | null;
  role: Role; status: Status; plan: string; plan_until: string | null; created_at: string;
};

// ---------- Tablas (se crean solas la primera vez) ----------
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending',
    plan TEXT NOT NULL DEFAULT 'Plan Bro',
    plan_until TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 45,
    room TEXT NOT NULL DEFAULT 'Sala 1',
    capacity INTEGER NOT NULL DEFAULT 20,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS classes_starts ON classes (starts_at)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (class_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    scanned_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS checkins_user ON checkins (user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS routines (
    user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Rutina de hoy',
    exercises TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_clp INTEGER NOT NULL DEFAULT 0,
    months INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan_id TEXT,
    plan_name TEXT NOT NULL,
    amount_clp INTEGER NOT NULL DEFAULT 0,
    months INTEGER NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS payments_date ON payments (created_at)`,
  `CREATE TABLE IF NOT EXISTS lifts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    exercise TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS lifts_user ON lifts (user_id, exercise, created_at)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

let schemaReady = false;
async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  schemaReady = true;
}

// ---------- Utilidades ----------
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const enc = new TextEncoder();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const b64url = (buf: ArrayBuffer | Uint8Array) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const fromB64url = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Claves (PBKDF2, 100.000 iteraciones: el máximo de Workers) ----------
const ITER = 100000;

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`;
}

async function checkPassword(password: string, stored: string) {
  const [kind, iter, saltB64, hashB64] = stored.split('$');
  if (kind !== 'pbkdf2') return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: Number(iter) },
    key,
    256,
  );
  return safeEqual(b64(bits), hashB64);
}

// ---------- Sesiones (token firmado HS256) ----------
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeToken(env: Env, userId: string) {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })));
  const sig = b64url(await hmac(env.JWT_SECRET, `${header}.${payload}`));
  return `${header}.${payload}.${sig}`;
}

async function readToken(env: Env, token: string): Promise<string | null> {
  const [header, payload, sig] = token.split('.');
  if (!header || !payload || !sig) return null;
  const expected = b64url(await hmac(env.JWT_SECRET, `${header}.${payload}`));
  if (!safeEqual(expected, sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return String(data.sub);
  } catch {
    return null;
  }
}

// ---------- QR de entrada (firmado, cambia cada 30 s) ----------
const QR_SLOT = 30;

async function qrSignature(env: Env, userId: string, slot: number) {
  return b64url(await hmac(env.JWT_SECRET, `qr|${userId}|${slot}`)).slice(0, 16);
}

async function makeQr(env: Env, userId: string) {
  const t = Math.floor(Date.now() / 1000);
  const slot = Math.floor(t / QR_SLOT) * QR_SLOT;
  return { code: `GB2.${userId}.${slot}.${await qrSignature(env, userId, slot)}`, expires_in: slot + QR_SLOT - t };
}

async function readQr(env: Env, code: string): Promise<{ userId: string } | { error: string }> {
  const parts = code.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'GB2') return { error: 'Código no válido' };
  const [, userId, slotS, sig] = parts;
  const slot = Number(slotS);
  if (!Number.isFinite(slot) || !safeEqual(await qrSignature(env, userId, slot), sig)) return { error: 'Código no válido' };
  if (Math.abs(Date.now() / 1000 - slot) > 90) return { error: 'Código vencido: pide al socio que lo actualice' };
  return { userId };
}

// ---------- Helpers de datos ----------
const publicUser = (u: UserRow) => {
  const { password_hash: _omit, ...rest } = u;
  return rest;
};

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Datos inválidos');
  }
}

const cleanEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function addMonths(fromISODate: string | null, months: number) {
  const today = new Date();
  const base = fromISODate && new Date(fromISODate + 'T23:59:59Z') > today ? new Date(fromISODate + 'T12:00:00Z') : today;
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function createUser(
  env: Env,
  data: { email: string; password: string; full_name: string; role?: Role; status?: Status; plan_until?: string | null },
) {
  if (!validEmail(data.email)) throw new HttpError(400, 'Correo no válido');
  if (data.password.length < 6) throw new HttpError(400, 'La clave debe tener al menos 6 caracteres');
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(data.email).first();
  if (exists) throw new HttpError(409, 'Ese correo ya tiene una cuenta');
  const id = uid();
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, status, plan_until, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, data.email, await hashPassword(data.password), data.full_name.trim(), data.role ?? 'member', data.status ?? 'pending', data.plan_until ?? null, now())
    .run();
  return (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>())!;
}

async function currentUser(req: Request, env: Env) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const id = token ? await readToken(env, token) : null;
  if (!id) throw new HttpError(401, 'Debes iniciar sesión');
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!user) throw new HttpError(401, 'Debes iniciar sesión');
  return user;
}

function requireAdmin(u: UserRow) {
  if (u.role !== 'admin') throw new HttpError(403, 'Solo un administrador puede hacer esto');
}

// Rango de "hoy", "esta semana", etc. según la zona horaria del celular
function localDayStart(offsetMin: number, daysAgo = 0) {
  const local = new Date(Date.now() - offsetMin * 60000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMin * 60000 - daysAgo * 86400000);
}
const localDayKey = (iso: string, offsetMin: number) => new Date(new Date(iso).getTime() - offsetMin * 60000).toISOString().slice(0, 10);

async function schedule(env: Env, userId: string, from: string, to: string) {
  const { results } = await env.DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id) AS booked_count,
       EXISTS (SELECT 1 FROM bookings b WHERE b.class_id = c.id AND b.user_id = ?) AS is_booked
     FROM classes c WHERE c.starts_at >= ? AND c.starts_at < ? ORDER BY c.starts_at`,
  )
    .bind(userId, from, to)
    .all<Record<string, unknown>>();
  return results.map((r) => ({ ...r, is_booked: Boolean(r.is_booked), booked_count: Number(r.booked_count) }));
}

async function registerCheckin(env: Env, userId: string, by: string | null) {
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!u) return { ok: false, reason: 'Socio no encontrado' };
  if (u.status !== 'active') return { ok: false, name: u.full_name, reason: 'Cuenta no activa' };
  if (u.plan_until && u.plan_until < new Date().toISOString().slice(0, 10)) {
    return { ok: false, name: u.full_name, reason: `Plan vencido el ${u.plan_until}` };
  }
  await env.DB.prepare('INSERT INTO checkins (id, user_id, scanned_by, created_at) VALUES (?, ?, ?, ?)').bind(uid(), userId, by, now()).run();
  return { ok: true, name: u.full_name, plan: u.plan, plan_until: u.plan_until };
}

// Personas en el gym ahora: socios distintos que entraron en los últimos 90 minutos
const STAY_MIN = 90;
async function occupancy(env: Env) {
  const since = new Date(Date.now() - STAY_MIN * 60000).toISOString();
  const row = await env.DB.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM checkins WHERE created_at >= ?').bind(since).first<{ n: number }>();
  const cap = await env.DB.prepare("SELECT value FROM settings WHERE key = 'capacity'").first<{ value: string }>();
  const capacity = cap ? Number(cap.value) || null : null;
  return { now: Number(row?.n ?? 0), capacity, window_min: STAY_MIN };
}

type PlanRow = { id: string; name: string; price_clp: number; months: number; active: number; created_at: string };
const publicPlan = (p: PlanRow) => ({ ...p, active: Boolean(p.active) });

// Activa o renueva un plan y deja registrada la venta
async function sellPlan(env: Env, target: UserRow, planId: string, adminId: string) {
  const plan = await env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(planId).first<PlanRow>();
  if (!plan) throw new HttpError(404, 'El plan no existe');
  const until = addMonths(target.plan_until, plan.months);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = 'active', plan = ?, plan_until = ? WHERE id = ?").bind(plan.name, until, target.id),
    env.DB.prepare(
      'INSERT INTO payments (id, user_id, plan_id, plan_name, amount_clp, months, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(uid(), target.id, plan.id, plan.name, plan.price_clp, plan.months, adminId, now()),
  ]);
}

// ---------- API ----------
async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  const seg = path.split('/').slice(2); // ['auth','login'] ...
  const tz = Number(url.searchParams.get('tz') ?? '0') || 0;

  // --- Público ---
  if (m === 'POST' && path === '/api/auth/register') {
    const b = await body<{ full_name?: string; email?: string; password?: string }>(req);
    if (!String(b.full_name ?? '').trim()) throw new HttpError(400, 'Escribe tu nombre');
    const user = await createUser(env, { email: cleanEmail(b.email), password: String(b.password ?? ''), full_name: String(b.full_name) });
    return json({ token: await makeToken(env, user.id), user: publicUser(user) });
  }

  if (m === 'POST' && path === '/api/auth/login') {
    const b = await body<{ email?: string; password?: string }>(req);
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail(b.email)).first<UserRow>();
    if (!user || !(await checkPassword(String(b.password ?? ''), user.password_hash))) {
      throw new HttpError(401, 'Correo o clave incorrectos');
    }
    return json({ token: await makeToken(env, user.id), user: publicUser(user) });
  }

  if (m === 'GET' && path === '/api/health') return json({ ok: true });

  // --- Con sesión ---
  const me = await currentUser(req, env);

  if (path === '/api/me' && m === 'GET') return json(publicUser(me));

  if (path === '/api/me' && m === 'PATCH') {
    const b = await body<{ full_name?: string; phone?: string | null }>(req);
    await env.DB.prepare('UPDATE users SET full_name = ?, phone = ? WHERE id = ?')
      .bind(String(b.full_name ?? me.full_name).trim(), b.phone ? String(b.phone).trim() : null, me.id)
      .run();
    return json(publicUser((await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first<UserRow>())!));
  }

  if (path === '/api/me/password' && m === 'POST') {
    const b = await body<{ current?: string; next?: string }>(req);
    if (!(await checkPassword(String(b.current ?? ''), me.password_hash))) throw new HttpError(400, 'La clave actual no es correcta');
    if (String(b.next ?? '').length < 6) throw new HttpError(400, 'La nueva clave debe tener al menos 6 caracteres');
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(b.next)), me.id).run();
    return json({ ok: true });
  }

  if (path === '/api/me/qr' && m === 'GET') {
    if (me.status !== 'active') throw new HttpError(403, 'Tu cuenta no está activa');
    return json(await makeQr(env, me.id));
  }

  if (path === '/api/me/stats' && m === 'GET') {
    const since = localDayStart(tz, 62).toISOString();
    const { results } = await env.DB.prepare('SELECT created_at FROM checkins WHERE user_id = ? AND created_at >= ?')
      .bind(me.id, since)
      .all<{ created_at: string }>();
    const days = new Set(results.map((r) => localDayKey(r.created_at, tz)));
    const todayKey = localDayKey(now(), tz);
    // semana lunes→domingo
    const todayLocal = new Date(todayKey + 'T00:00:00Z');
    const monday = new Date(todayLocal.getTime() - ((todayLocal.getUTCDay() + 6) % 7) * 86400000);
    const week = Array.from({ length: 7 }, (_, i) => days.has(new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10)));
    // racha
    let cursor = todayLocal.getTime();
    if (!days.has(todayKey)) cursor -= 86400000;
    let streak = 0;
    while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
      streak++;
      cursor -= 86400000;
    }
    const monthPrefix = todayKey.slice(0, 7);
    const month = results.filter((r) => localDayKey(r.created_at, tz).startsWith(monthPrefix)).length;
    const upcoming = await env.DB.prepare(
      `SELECT c.* FROM bookings b JOIN classes c ON c.id = b.class_id
       WHERE b.user_id = ? AND c.starts_at >= ? ORDER BY c.starts_at`,
    )
      .bind(me.id, now())
      .all<Record<string, unknown>>();
    return json({ week, streak, month, booked: upcoming.results.length, next_class: upcoming.results[0] ?? null });
  }

  if (path === '/api/me/routine' && m === 'GET') {
    const r = await env.DB.prepare('SELECT title, exercises FROM routines WHERE user_id = ?').bind(me.id).first<{ title: string; exercises: string }>();
    return json(r ? { title: r.title, exercises: JSON.parse(r.exercises) } : null);
  }

  if (path === '/api/classes' && m === 'GET') {
    const from = url.searchParams.get('from') ?? now();
    const to = url.searchParams.get('to') ?? new Date(Date.now() + 7 * 86400000).toISOString();
    return json(await schedule(env, me.id, new Date(from).toISOString(), new Date(to).toISOString()));
  }

  // /api/classes/:id/book
  if (seg[0] === 'classes' && seg[2] === 'book' && seg.length === 3) {
    const classId = seg[1];
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM bookings WHERE class_id = ? AND user_id = ?').bind(classId, me.id).run();
      return json({ ok: true });
    }
    if (m === 'POST') {
      if (me.status !== 'active') throw new HttpError(403, 'Tu cuenta no está activa');
      const c = await env.DB.prepare('SELECT * FROM classes WHERE id = ?').bind(classId).first<{ capacity: number; starts_at: string }>();
      if (!c) throw new HttpError(404, 'La clase no existe');
      if (c.starts_at < now()) throw new HttpError(400, 'La clase ya empezó');
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE class_id = ?').bind(classId).first<{ n: number }>();
      if (Number(count?.n ?? 0) >= c.capacity) throw new HttpError(409, 'No quedan cupos');
      await env.DB.prepare('INSERT OR IGNORE INTO bookings (id, class_id, user_id, created_at) VALUES (?, ?, ?, ?)').bind(uid(), classId, me.id, now()).run();
      return json({ ok: true });
    }
  }

  if (path === '/api/plans' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY months, price_clp').all<PlanRow>();
    return json(results.map(publicPlan));
  }

  if (path === '/api/occupancy' && m === 'GET') return json(await occupancy(env));

  // Último check-in del socio (la app lo consulta para mostrar la celebración)
  if (path === '/api/me/last-checkin' && m === 'GET') {
    const r = await env.DB.prepare('SELECT id, created_at FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(me.id)
      .first<{ id: string; created_at: string }>();
    return json(r ?? null);
  }

  // --- Registro de pesos y récords ---
  if (path === '/api/me/lifts' && m === 'POST') {
    const b = await body<{ exercise?: string; weight_kg?: number; reps?: number }>(req);
    let exercise = String(b.exercise ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const weight = Number(b.weight_kg);
    const reps = Math.round(Number(b.reps));
    if (!exercise) throw new HttpError(400, 'Escribe el ejercicio');
    if (!Number.isFinite(weight) || weight < 0 || weight > 1000) throw new HttpError(400, 'Peso no válido');
    if (!Number.isFinite(reps) || reps < 1 || reps > 200) throw new HttpError(400, 'Repeticiones no válidas');
    // Si ya existe con otras mayúsculas ("press banca" / "Press banca"), se usa el mismo nombre
    const same = await env.DB.prepare('SELECT exercise FROM lifts WHERE user_id = ? AND exercise = ? COLLATE NOCASE LIMIT 1')
      .bind(me.id, exercise)
      .first<{ exercise: string }>();
    if (same) exercise = same.exercise;
    const best = await env.DB.prepare('SELECT MAX(weight_kg) AS w FROM lifts WHERE user_id = ? AND exercise = ?')
      .bind(me.id, exercise)
      .first<{ w: number | null }>();
    const isPr = best?.w == null ? false : weight > Number(best.w);
    const id = uid();
    await env.DB.prepare('INSERT INTO lifts (id, user_id, exercise, weight_kg, reps, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, me.id, exercise, weight, reps, now())
      .run();
    return json({ id, is_pr: isPr, first: best?.w == null });
  }

  if (path === '/api/me/lifts' && m === 'GET') {
    const exercise = url.searchParams.get('exercise');
    if (exercise) {
      const { results } = await env.DB.prepare(
        'SELECT id, exercise, weight_kg, reps, created_at FROM lifts WHERE user_id = ? AND exercise = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 100',
      )
        .bind(me.id, exercise)
        .all();
      return json(results);
    }
    // Resumen por ejercicio: récord, último y cantidad
    const { results } = await env.DB.prepare(
      `SELECT l.exercise AS exercise, MAX(l.weight_kg) AS best_kg, COUNT(*) AS sets, MAX(l.created_at) AS last_at,
         (SELECT weight_kg FROM lifts x WHERE x.user_id = l.user_id AND x.exercise = l.exercise ORDER BY x.created_at DESC LIMIT 1) AS last_kg,
         (SELECT reps FROM lifts x WHERE x.user_id = l.user_id AND x.exercise = l.exercise ORDER BY x.created_at DESC LIMIT 1) AS last_reps
       FROM lifts l WHERE l.user_id = ? GROUP BY l.exercise ORDER BY last_at DESC`,
    )
      .bind(me.id)
      .all();
    return json(results);
  }

  if (seg[0] === 'me' && seg[1] === 'lifts' && seg[2] && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM lifts WHERE id = ? AND user_id = ?').bind(seg[2], me.id).run();
    return json({ ok: true });
  }

  // --- Solo administradores ---
  if (seg[0] === 'admin') {
    requireAdmin(me);

    // Panel "Hoy"
    if (path === '/api/admin/today' && m === 'GET') {
      const dayStart = localDayStart(tz).toISOString();
      const todayKey = localDayKey(now(), tz);
      const monthStart = new Date(new Date(todayKey.slice(0, 7) + '-01T00:00:00Z').getTime() + tz * 60000).toISOString();
      const in7 = new Date(new Date(todayKey + 'T00:00:00Z').getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const q = (sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).first<{ n: number }>();
      const [today, members, pending, newMonth, sales, expiring, recent, occ] = await Promise.all([
        q('SELECT COUNT(*) AS n FROM checkins WHERE created_at >= ?', dayStart),
        q("SELECT COUNT(*) AS n FROM users WHERE role = 'member' AND status = 'active'"),
        q("SELECT COUNT(*) AS n FROM users WHERE role = 'member' AND status = 'pending'"),
        q("SELECT COUNT(*) AS n FROM users WHERE role = 'member' AND created_at >= ?", monthStart),
        env.DB.prepare('SELECT COALESCE(SUM(amount_clp), 0) AS total, COUNT(*) AS n FROM payments WHERE created_at >= ?')
          .bind(monthStart)
          .first<{ total: number; n: number }>(),
        env.DB.prepare(
          `SELECT * FROM users WHERE role = 'member' AND status = 'active' AND plan_until IS NOT NULL AND plan_until <= ?
           ORDER BY plan_until LIMIT 50`,
        )
          .bind(in7)
          .all<UserRow>(),
        env.DB.prepare(
          `SELECT c.created_at, u.id AS user_id, u.full_name FROM checkins c JOIN users u ON u.id = c.user_id
           ORDER BY c.created_at DESC LIMIT 8`,
        ).all<{ created_at: string; user_id: string; full_name: string }>(),
        occupancy(env),
      ]);
      return json({
        checkins_today: Number(today?.n ?? 0),
        in_gym_now: occ.now,
        capacity: occ.capacity,
        active_members: Number(members?.n ?? 0),
        pending: Number(pending?.n ?? 0),
        new_this_month: Number(newMonth?.n ?? 0),
        sales_month_clp: Number(sales?.total ?? 0),
        sales_month_count: Number(sales?.n ?? 0),
        expiring: expiring.results.map(publicUser),
        recent: recent.results,
      });
    }

    // Ajustes del gym (aforo máximo)
    if (path === '/api/admin/settings' && m === 'PUT') {
      const b = await body<{ capacity?: number | null }>(req);
      const cap = Number(b.capacity);
      if (b.capacity == null || !cap) await env.DB.prepare("DELETE FROM settings WHERE key = 'capacity'").run();
      else
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('capacity', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
          .bind(String(Math.max(1, Math.round(cap))))
          .run();
      return json(await occupancy(env));
    }

    // Planes y precios
    if (path === '/api/admin/plans' && m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM plans ORDER BY active DESC, months, price_clp').all<PlanRow>();
      return json(results.map(publicPlan));
    }
    if (path === '/api/admin/plans' && m === 'POST') {
      const b = await body<{ name?: string; price_clp?: number; months?: number }>(req);
      const name = String(b.name ?? '').trim();
      const price = Math.round(Number(b.price_clp));
      const months = Math.round(Number(b.months));
      if (!name) throw new HttpError(400, 'Escribe el nombre del plan');
      if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Precio no válido');
      if (!Number.isFinite(months) || months < 1 || months > 36) throw new HttpError(400, 'Duración no válida (1 a 36 meses)');
      const id = uid();
      await env.DB.prepare('INSERT INTO plans (id, name, price_clp, months, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
        .bind(id, name, price, months, now())
        .run();
      return json({ id });
    }
    if (seg[1] === 'plans' && seg[2] && m === 'PATCH') {
      const plan = await env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(seg[2]).first<PlanRow>();
      if (!plan) throw new HttpError(404, 'El plan no existe');
      const b = await body<{ name?: string; price_clp?: number; months?: number; active?: boolean }>(req);
      await env.DB.prepare('UPDATE plans SET name = ?, price_clp = ?, months = ?, active = ? WHERE id = ?')
        .bind(
          b.name != null ? String(b.name).trim() || plan.name : plan.name,
          b.price_clp != null ? Math.max(0, Math.round(Number(b.price_clp)) || 0) : plan.price_clp,
          b.months != null ? Math.min(36, Math.max(1, Math.round(Number(b.months)) || 1)) : plan.months,
          b.active != null ? (b.active ? 1 : 0) : plan.active,
          plan.id,
        )
        .run();
      return json({ ok: true });
    }

    if (path === '/api/admin/users' && m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all<UserRow>();
      return json(results.map(publicUser));
    }

    if (path === '/api/admin/users' && m === 'POST') {
      const b = await body<{ full_name?: string; email?: string; password?: string; months?: number; role?: string; plan_id?: string }>(req);
      if (!String(b.full_name ?? '').trim()) throw new HttpError(400, 'Falta el nombre');
      const role: Role = b.role === 'admin' ? 'admin' : 'member';
      const months = Number(b.months ?? 0);
      const user = await createUser(env, {
        email: cleanEmail(b.email),
        password: String(b.password ?? ''),
        full_name: String(b.full_name),
        role,
        status: 'active',
        plan_until: role === 'member' && months > 0 && !b.plan_id ? addMonths(null, months) : null,
      });
      if (role === 'member' && b.plan_id) await sellPlan(env, user, b.plan_id, me.id);
      return json(publicUser((await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>())!));
    }

    if (path === '/api/admin/checkin' && m === 'POST') {
      const b = await body<{ code?: string }>(req);
      const q = await readQr(env, String(b.code ?? ''));
      if ('error' in q) return json({ ok: false, reason: q.error });
      return json(await registerCheckin(env, q.userId, me.id));
    }

    if (path === '/api/admin/classes' && m === 'POST') {
      const b = await body<{ name?: string; starts_at?: string; duration_min?: number; room?: string; capacity?: number }>(req);
      const start = new Date(String(b.starts_at ?? ''));
      if (!String(b.name ?? '').trim() || isNaN(start.getTime())) throw new HttpError(400, 'Falta el nombre o la fecha');
      const id = uid();
      await env.DB.prepare('INSERT INTO classes (id, name, starts_at, duration_min, room, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, String(b.name).trim(), start.toISOString(), Number(b.duration_min) || 45, String(b.room ?? 'Sala 1').trim() || 'Sala 1', Number(b.capacity) || 20, now())
        .run();
      return json({ id });
    }

    if (seg[1] === 'classes' && seg.length === 3 && m === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM bookings WHERE class_id = ?').bind(seg[2]),
        env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(seg[2]),
      ]);
      return json({ ok: true });
    }

    // /api/admin/users/:id[/...]
    if (seg[1] === 'users' && seg[2]) {
      const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(seg[2]).first<UserRow>();
      if (!target) throw new HttpError(404, 'Cuenta no encontrada');
      const sub = seg[3];

      if (!sub && m === 'GET') {
        const { results } = await env.DB.prepare('SELECT created_at FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 8')
          .bind(target.id)
          .all<{ created_at: string }>();
        const pays = await env.DB.prepare(
          'SELECT plan_name, amount_clp, months, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        )
          .bind(target.id)
          .all();
        return json({ user: publicUser(target), visits: results.map((r) => r.created_at), payments: pays.results });
      }

      if (!sub && m === 'PATCH') {
        const b = await body<{ status?: Status; role?: Role; add_months?: number; plan?: string; full_name?: string; plan_id?: string }>(req);
        if (b.plan_id) {
          await sellPlan(env, target, b.plan_id, me.id);
          return json(publicUser((await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(target.id).first<UserRow>())!));
        }
        const isSelf = target.id === me.id;
        let { status, role, plan_until, plan, full_name } = target;
        if (b.status && ['pending', 'active', 'inactive'].includes(b.status)) {
          if (isSelf && b.status !== 'active') throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
          status = b.status;
        }
        if (b.role && ['admin', 'member'].includes(b.role)) {
          if (isSelf) throw new HttpError(400, 'No puedes cambiar tu propio rol');
          role = b.role;
          if (role === 'admin') status = 'active';
        }
        if (b.add_months && Number(b.add_months) > 0) {
          plan_until = addMonths(plan_until, Number(b.add_months));
          status = 'active';
        }
        if (b.plan) plan = String(b.plan).trim();
        if (b.full_name) full_name = String(b.full_name).trim();
        await env.DB.prepare('UPDATE users SET status = ?, role = ?, plan_until = ?, plan = ?, full_name = ? WHERE id = ?')
          .bind(status, role, plan_until, plan, full_name, target.id)
          .run();
        return json(publicUser((await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(target.id).first<UserRow>())!));
      }

      if (sub === 'checkin' && m === 'POST') return json(await registerCheckin(env, target.id, me.id));

      if (sub === 'password' && m === 'POST') {
        const b = await body<{ password?: string }>(req);
        if (String(b.password ?? '').length < 6) throw new HttpError(400, 'La clave debe tener al menos 6 caracteres');
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(b.password)), target.id).run();
        return json({ ok: true });
      }

      if (sub === 'routine' && m === 'GET') {
        const r = await env.DB.prepare('SELECT title, exercises FROM routines WHERE user_id = ?').bind(target.id).first<{ title: string; exercises: string }>();
        return json(r ? { title: r.title, exercises: JSON.parse(r.exercises) } : null);
      }

      if (sub === 'routine' && m === 'PUT') {
        const b = await body<{ title?: string; exercises?: unknown[] }>(req);
        const exercises = Array.isArray(b.exercises) ? b.exercises.slice(0, 40) : [];
        await env.DB.prepare(
          `INSERT INTO routines (user_id, title, exercises, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET title = excluded.title, exercises = excluded.exercises, updated_at = excluded.updated_at`,
        )
          .bind(target.id, String(b.title ?? 'Rutina de hoy').trim() || 'Rutina de hoy', JSON.stringify(exercises), now())
          .run();
        return json({ ok: true });
      }
    }
  }

  throw new HttpError(404, 'Ruta no encontrada');
}

// ---------- Página /setup: crear los administradores base ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function setupPage(message = '', ok = false) {
  const field = (n: number) => `
    <fieldset><legend>Administrador ${n}</legend>
      <label>Nombre<input name="name${n}" ${n === 1 ? 'required' : ''}></label>
      <label>Correo<input name="email${n}" type="email" ${n === 1 ? 'required' : ''}></label>
      <label>Clave (mínimo 6)<input name="password${n}" type="password" minlength="6" ${n === 1 ? 'required' : ''}></label>
    </fieldset>`;
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GYM BROS · Crear administradores</title>
<style>
body{margin:0;background:#0B0B0B;color:#fff;font:16px system-ui,sans-serif;display:flex;justify-content:center;padding:24px}
main{max-width:420px;width:100%;display:flex;flex-direction:column;gap:16px}
h1{margin:0;font-size:24px;letter-spacing:1px}h1 span{color:#E8915A}
p{color:#A3A3A3;margin:0;line-height:1.5}
fieldset{border:1px solid #262626;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;background:#161616}
legend{color:#E8915A;font-weight:700;padding:0 6px}
label{display:flex;flex-direction:column;gap:6px;color:#A3A3A3;font-size:14px}
input{height:46px;border-radius:12px;border:1px solid #3A3A3A;background:#0B0B0B;color:#fff;padding:0 14px;font-size:16px}
button{height:54px;border:0;border-radius:14px;background:#E8915A;color:#0B0B0B;font-weight:800;font-size:16px;cursor:pointer}
.msg{padding:14px;border-radius:12px;border:1px solid ${ok ? '#4CC38A' : '#E5484D'};color:#fff;white-space:pre-line}
</style></head><body><main>
<h1>GYM <span>BROS</span> · Administradores</h1>
<p>Crea las cuentas de administrador. Si un correo ya existe, se convierte en administrador (y se actualiza su clave si escribes una).</p>
${message ? `<div class="msg">${esc(message)}</div>` : ''}
<form method="post" style="display:flex;flex-direction:column;gap:16px">
<label>Clave de configuración (SETUP_KEY)<input name="key" type="password" required></label>
${field(1)}${field(2)}
<button type="submit">CREAR ADMINISTRADORES</button>
</form>
<p>Cuando termines, borra la variable SETUP_KEY en Cloudflare para cerrar esta página.</p>
</main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function handleSetup(req: Request, env: Env) {
  if (!env.SETUP_KEY) return new Response('Página de configuración cerrada.', { status: 404 });
  if (req.method !== 'POST') return setupPage();
  const form = await req.formData();
  if (!safeEqual(String(form.get('key') ?? ''), env.SETUP_KEY)) return setupPage('Clave de configuración incorrecta.');
  const lines: string[] = [];
  for (const n of [1, 2]) {
    const email = cleanEmail(form.get(`email${n}`));
    if (!email) continue;
    const name = String(form.get(`name${n}`) ?? '').trim();
    const password = String(form.get(`password${n}`) ?? '');
    try {
      const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
      if (existing) {
        await env.DB.prepare('UPDATE users SET role = ?, status = ?, full_name = ? WHERE id = ?')
          .bind('admin', 'active', name || existing.full_name, existing.id)
          .run();
        if (password.length >= 6) {
          await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), existing.id).run();
        }
        lines.push(`✓ ${email} ahora es administrador`);
      } else {
        await createUser(env, { email, password, full_name: name, role: 'admin', status: 'active' });
        lines.push(`✓ ${email} creado como administrador`);
      }
    } catch (e) {
      lines.push(`✗ ${email}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }
  return setupPage(lines.join('\n') || 'No escribiste ningún correo.', lines.some((l) => l.startsWith('✓')));
}

// ---------- Entrada principal ----------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
          return json({ error: 'Falta configurar JWT_SECRET en Cloudflare (mínimo 16 caracteres)' }, 500);
        }
        await ensureSchema(env.DB);
        return await handleApi(req, env, url);
      }
      if (url.pathname === '/setup') {
        await ensureSchema(env.DB);
        return await handleSetup(req, env);
      }
      if (env.ASSETS) return env.ASSETS.fetch(req);
      return new Response('GYM BROS', { status: 200 });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Error del servidor' }, 500);
    }
  },
};
