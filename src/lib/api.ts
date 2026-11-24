import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// En la web la API está en el mismo dominio (/api). En el celular nativo se usa EXPO_PUBLIC_API_URL.
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const isConfigured = Platform.OS === 'web' || /^https?:\/\//.test(BASE);

const TOKEN_KEY = 'gymbros.token';
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken() {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, data?.error ?? 'Algo salió mal, intenta de nuevo');
  }
  return data as T;
}

// Minutos de diferencia con UTC (Chile ≈ 180), para calcular "hoy" y "esta semana"
export const tz = () => new Date().getTimezoneOffset();

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Algo salió mal');

// ---------- Tipos ----------
export type Role = 'admin' | 'member';
export type Status = 'pending' | 'active' | 'inactive';

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: Status;
  plan: string;
  plan_until: string | null;
  created_at: string;
};

export type ClassInfo = { id: string; name: string; starts_at: string; duration_min: number; room: string; capacity: number };

export type ScheduledClass = ClassInfo & { booked_count: number; is_booked: boolean };

export type Exercise = { name: string; detail?: string; sets: string };

export type Routine = { title: string; exercises: Exercise[] };

export type Stats = {
  week: boolean[];
  streak: number;
  month: number;
  booked: number;
  next_class: ClassInfo | null;
};

export type CheckinResult = { ok: boolean; name?: string; reason?: string; plan?: string; plan_until?: string | null };

export type Plan = { id: string; name: string; price_clp: number; months: number; active: boolean };

export type Occupancy = { now: number; capacity: number | null; window_min: number };

export type Payment = { plan_name: string; amount_clp: number; months: number; created_at: string };

export type Today = {
  checkins_today: number;
  in_gym_now: number;
  capacity: number | null;
  active_members: number;
  pending: number;
  new_this_month: number;
  sales_month_clp: number;
  sales_month_count: number;
  expiring: Profile[];
  recent: { created_at: string; user_id: string; full_name: string }[];
};

export type LiftSummary = {
  exercise: string;
  best_kg: number;
  sets: number;
  last_at: string;
  last_kg: number;
  last_reps: number;
};

export type Lift = { id: string; exercise: string; weight_kg: number; reps: number; created_at: string };
