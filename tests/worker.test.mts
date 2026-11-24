// Prueba de punta a punta del worker con una D1 simulada sobre SQLite.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
function prep(sql: string, args: unknown[] = []): any {
  return {
    bind: (...v: unknown[]) => prep(sql, v),
    first: async () => (sqlite.prepare(sql).get(...(args as any[])) as any) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...(args as any[])) }),
    run: async () => sqlite.prepare(sql).run(...(args as any[])),
  };
}
const DB = { prepare: (sql: string) => prep(sql), batch: async (st: any[]) => { for (const s of st) await s.run(); } };
const env: any = { DB, JWT_SECRET: 'super-secreto-de-prueba-123', SETUP_KEY: 'clave-setup' };

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(new Request('https://gymbros.test' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

// 1. /setup crea 2 admins
const form = new FormData();
form.set('key', 'clave-setup');
form.set('name1', 'Admin Uno'); form.set('email1', 'Admin1@GymBros.cl'); form.set('password1', 'clave111');
form.set('name2', 'Admin Dos'); form.set('email2', 'admin2@gymbros.cl'); form.set('password2', 'clave222');
let r: any = await worker.fetch(new Request('https://gymbros.test/setup', { method: 'POST', body: form }), env);
const html = await r.text();
assert.match(html, /admin1@gymbros\.cl creado como administrador/);
assert.match(html, /admin2@gymbros\.cl creado como administrador/);
const badForm = new FormData(); badForm.set('key', 'mala');
assert.match(await (await worker.fetch(new Request('https://gymbros.test/setup', { method: 'POST', body: badForm }), env)).text(), /incorrecta/);

// 2. Login admin
r = await call('POST', '/api/auth/login', { email: 'admin1@gymbros.cl', password: 'clave111' });
assert.equal(r.status, 200); assert.equal(r.data.user.role, 'admin'); assert.equal(r.data.user.password_hash, undefined);
const admin = r.data.token;
assert.equal((await call('POST', '/api/auth/login', { email: 'admin1@gymbros.cl', password: 'mala' })).status, 401);

// 3. Socio se registra → pendiente, no puede pedir QR ni reservar
r = await call('POST', '/api/auth/register', { full_name: 'Juan Pérez', email: 'juan@correo.cl', password: '123456' });
assert.equal(r.status, 200); assert.equal(r.data.user.status, 'pending');
const juan = r.data.token; const juanId = r.data.user.id;
assert.equal((await call('GET', '/api/me/qr', undefined, juan)).status, 403);
assert.equal((await call('POST', '/api/auth/register', { full_name: 'X', email: 'juan@correo.cl', password: '123456' })).status, 409);

// 4. Socio no puede usar rutas de admin
assert.equal((await call('GET', '/api/admin/users', undefined, juan)).status, 403);
assert.equal((await call('GET', '/api/admin/users')).status, 401);
assert.equal((await call('GET', '/api/me', undefined, 'token.falso.x')).status, 401);

// 5. Admin activa 1 mes
r = await call('PATCH', `/api/admin/users/${juanId}`, { add_months: 1 }, admin);
assert.equal(r.data.status, 'active'); assert.ok(r.data.plan_until);
r = await call('PATCH', `/api/admin/users/${juanId}`, { add_months: 3 }, admin);
const until = new Date(r.data.plan_until); const expect = new Date(); expect.setUTCMonth(expect.getUTCMonth() + 4);
assert.ok(Math.abs(until.getTime() - expect.getTime()) < 3 * 86400000, 'suma meses sobre el vencimiento');

// 6. Admin crea clase, socio reserva (cupo 1), segundo socio queda sin cupo
const start = new Date(Date.now() + 3600_000).toISOString();
r = await call('POST', '/api/admin/classes', { name: 'Funcional', starts_at: start, duration_min: 45, room: 'Sala 1', capacity: 1 }, admin);
const classId = r.data.id;
assert.equal((await call('POST', `/api/classes/${classId}/book`, undefined, juan)).status, 200);
r = await call('GET', `/api/classes?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 86400000).toISOString())}`, undefined, juan);
assert.equal(r.data.length, 1); assert.equal(r.data[0].is_booked, true); assert.equal(r.data[0].booked_count, 1);
r = await call('POST', '/api/admin/users', { full_name: 'Ana', email: 'ana@correo.cl', password: '654321', months: 1 }, admin);
assert.equal(r.data.status, 'active');
const ana = (await call('POST', '/api/auth/login', { email: 'ana@correo.cl', password: '654321' })).data.token;
r = await call('POST', `/api/classes/${classId}/book`, undefined, ana);
assert.equal(r.status, 409); assert.equal(r.data.error, 'No quedan cupos');
assert.equal((await call('DELETE', `/api/classes/${classId}/book`, undefined, juan)).status, 200);
assert.equal((await call('POST', `/api/classes/${classId}/book`, undefined, ana)).status, 200);

// 7. QR firmado → admin escanea → check-in; QR alterado se rechaza
r = await call('GET', '/api/me/qr', undefined, juan);
assert.match(r.data.code, /^GB2\./);
const scan = await call('POST', '/api/admin/checkin', { code: r.data.code }, admin);
assert.equal(scan.data.ok, true); assert.equal(scan.data.name, 'Juan Pérez');
const forged = r.data.code.replace(juanId, (await call('GET', '/api/me', undefined, ana)).data.id);
assert.equal((await call('POST', '/api/admin/checkin', { code: forged }, admin)).data.ok, false);
assert.equal((await call('POST', '/api/admin/checkin', { code: 'GB1|x|1' }, admin)).data.ok, false);

// 8. Estadísticas del socio (zona horaria Chile = 180)
r = await call('GET', '/api/me/stats?tz=180', undefined, juan);
assert.equal(r.data.week.filter(Boolean).length, 1); assert.equal(r.data.streak, 1); assert.equal(r.data.month, 1);
r = await call('GET', '/api/me/stats?tz=180', undefined, ana);
assert.equal(r.data.booked, 1); assert.equal(r.data.next_class.name, 'Funcional');

// 9. Desactivar → escaneo y QR bloqueados; check-in manual dice cuenta no activa
await call('PATCH', `/api/admin/users/${juanId}`, { status: 'inactive' }, admin);
assert.equal((await call('POST', `/api/admin/users/${juanId}/checkin`, undefined, admin)).data.reason, 'Cuenta no activa');
assert.equal((await call('GET', '/api/me/qr', undefined, juan)).status, 403);

// 10. Rutina asignada por admin y vista por el socio
await call('PUT', `/api/admin/users/${juanId}/routine`, { title: 'Pecho', exercises: [{ name: 'Press banca', sets: '4×10' }] }, admin);
r = await call('GET', '/api/me/routine', undefined, juan);
assert.equal(r.data.title, 'Pecho'); assert.equal(r.data.exercises[0].name, 'Press banca');

// 11. Detalle, cambio de rol, protecciones del admin sobre sí mismo
r = await call('GET', `/api/admin/users/${juanId}`, undefined, admin);
assert.equal(r.data.visits.length, 1);
const adminId = (await call('GET', '/api/me', undefined, admin)).data.id;
assert.equal((await call('PATCH', `/api/admin/users/${adminId}`, { status: 'inactive' }, admin)).status, 400);
r = await call('PATCH', `/api/admin/users/${juanId}`, { role: 'admin' }, admin);
assert.equal(r.data.role, 'admin'); assert.equal(r.data.status, 'active');

// 12. Socio edita sus datos pero no su rol; cambia su clave
r = await call('PATCH', '/api/me', { full_name: 'Ana María', phone: '+56911112222', role: 'admin' }, ana);
assert.equal(r.data.full_name, 'Ana María'); assert.equal(r.data.role, 'member');
assert.equal((await call('POST', '/api/me/password', { current: '654321', next: 'nueva123' }, ana)).status, 200);
assert.equal((await call('POST', '/api/auth/login', { email: 'ana@correo.cl', password: 'nueva123' })).status, 200);

// 13. Eliminar clase borra sus reservas
assert.equal((await call('DELETE', `/api/admin/classes/${classId}`, undefined, admin)).status, 200);
assert.equal((await call('GET', '/api/me/stats?tz=180', undefined, ana)).data.booked, 0);

// 14. Sin SETUP_KEY la página se cierra
delete env.SETUP_KEY;
assert.equal((await worker.fetch(new Request('https://gymbros.test/setup'), env)).status, 404);

// ===== Paquete 1 =====
env.SETUP_KEY = undefined;
// 15. Planes: solo admin crea; socio ve los activos
r = await call('POST', '/api/admin/plans', { name: 'Mensual', price_clp: 25000, months: 1 }, admin);
const mensual = r.data.id;
r = await call('POST', '/api/admin/plans', { name: 'Trimestral', price_clp: 65000, months: 3 }, admin);
const trimestral = r.data.id;
assert.equal((await call('POST', '/api/admin/plans', { name: 'X', price_clp: 1, months: 1 }, ana)).status, 403);
assert.equal((await call('POST', '/api/admin/plans', { name: 'X', price_clp: 1, months: 0 }, admin)).status, 400);
r = await call('GET', '/api/plans', undefined, ana);
assert.deepEqual(r.data.map((p: any) => p.name), ['Mensual', 'Trimestral']);
await call('PATCH', `/api/admin/plans/${trimestral}`, { active: false }, admin);
assert.equal((await call('GET', '/api/plans', undefined, ana)).data.length, 1);
await call('PATCH', `/api/admin/plans/${trimestral}`, { active: true, price_clp: 60000 }, admin);

// 16. Vender plan a socio nuevo pendiente → activo, plan y venta registrada
r = await call('POST', '/api/auth/register', { full_name: 'Pedro Soto', email: 'pedro@correo.cl', password: '123456' });
const pedro = r.data.token; const pedroId = r.data.user.id;
r = await call('PATCH', `/api/admin/users/${pedroId}`, { plan_id: trimestral }, admin);
assert.equal(r.data.status, 'active'); assert.equal(r.data.plan, 'Trimestral');
r = await call('POST', '/api/admin/users', { full_name: 'Sofía', email: 'sofia@correo.cl', password: '123456', plan_id: mensual }, admin);
assert.equal(r.data.plan, 'Mensual'); assert.ok(r.data.plan_until);
r = await call('GET', `/api/admin/users/${pedroId}`, undefined, admin);
assert.equal(r.data.payments.length, 1); assert.equal(r.data.payments[0].amount_clp, 60000);

// 17. Aforo y panel Hoy
const pq = (await call('GET', '/api/me/qr', undefined, pedro)).data.code;
assert.equal((await call('POST', '/api/admin/checkin', { code: pq }, admin)).data.ok, true);
r = await call('GET', '/api/occupancy', undefined, pedro);
assert.equal(r.data.now, 2, 'Juan y Pedro entraron hace menos de 90 min'); assert.equal(r.data.capacity, null);
r = await call('PUT', '/api/admin/settings', { capacity: 60 }, admin);
assert.equal(r.data.capacity, 60);
r = await call('GET', '/api/admin/today?tz=180', undefined, admin);
assert.equal(r.data.checkins_today, 2); assert.equal(r.data.in_gym_now, 2);
assert.equal(r.data.sales_month_clp, 85000); assert.equal(r.data.sales_month_count, 2);
assert.equal(r.data.recent[0].full_name, 'Pedro Soto');
assert.equal(r.data.expiring.length, 0);
const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
sqlite.prepare('UPDATE users SET plan_until = ? WHERE id = ?').run(soon, pedroId);
r = await call('GET', '/api/admin/today?tz=180', undefined, admin);
assert.equal(r.data.expiring.length, 1); assert.equal(r.data.expiring[0].full_name, 'Pedro Soto');
assert.equal((await call('GET', '/api/admin/today', undefined, pedro)).status, 403);

// 18. Último check-in (para la celebración)
r = await call('GET', '/api/me/last-checkin', undefined, pedro);
assert.ok(r.data.id);
assert.equal((await call('GET', '/api/me/last-checkin', undefined, ana)).data, null);

// 19. Pesos y récords
r = await call('POST', '/api/me/lifts', { exercise: 'Press banca', weight_kg: 60, reps: 8 }, pedro);
assert.equal(r.data.first, true); assert.equal(r.data.is_pr, false);
r = await call('POST', '/api/me/lifts', { exercise: 'press banca', weight_kg: 65, reps: 6 }, pedro);
assert.equal(r.data.is_pr, true);
r = await call('POST', '/api/me/lifts', { exercise: 'Press banca', weight_kg: 62.5, reps: 8 }, pedro);
assert.equal(r.data.is_pr, false);
assert.equal((await call('POST', '/api/me/lifts', { exercise: 'Sentadilla', weight_kg: -5, reps: 5 }, pedro)).status, 400);
await call('POST', '/api/me/lifts', { exercise: 'Sentadilla', weight_kg: 80, reps: 5 }, pedro);
r = await call('GET', '/api/me/lifts', undefined, pedro);
assert.equal(r.data.length, 2);
const bench = r.data.find((x: any) => x.exercise.toLowerCase() === 'press banca');
assert.equal(bench.best_kg, 65); assert.equal(bench.last_kg, 62.5); assert.equal(bench.sets, 3);
r = await call('GET', '/api/me/lifts?exercise=Press%20banca', undefined, pedro);
assert.equal(r.data.length, 3);
assert.equal((await call('GET', '/api/me/lifts', undefined, ana)).data.length, 0, 'cada socio ve solo lo suyo');
await call('DELETE', `/api/me/lifts/${r.data[0].id}`, undefined, ana); // no es suyo: no borra
assert.equal((await call('GET', '/api/me/lifts?exercise=Press%20banca', undefined, pedro)).data.length, 3);
await call('DELETE', `/api/me/lifts/${r.data[0].id}`, undefined, pedro);
assert.equal((await call('GET', '/api/me/lifts?exercise=Press%20banca', undefined, pedro)).data.length, 2);

console.log('✓ Todas las pruebas del servidor pasaron (incluye Paquete 1)');
