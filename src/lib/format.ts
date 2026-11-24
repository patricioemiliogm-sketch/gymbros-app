const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const dayShort = (d: Date) => DAYS[d.getDay()];

export const time = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const dateLong = (value: string | Date | null) => {
  if (!value) return 'Sin fecha';
  const d = typeof value === 'string' ? parseDate(value) : value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// "2026-12-01" se interpreta como fecha local (no UTC)
export const parseDate = (s: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
};

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Lunes de la semana actual
export const startOfWeek = (d: Date) => {
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(startOfDay(d), -day);
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'GB';

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Bro';

export const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  inactive: 'Inactivo',
};

// $25.000 (pesos chilenos, sin decimales)
export const clp = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Días que faltan hasta una fecha "AAAA-MM-DD" (negativo si ya pasó)
export const daysUntil = (isoDate: string | null) => {
  if (!isoDate) return null;
  const target = parseDate(isoDate).getTime();
  return Math.round((target - startOfDay(new Date()).getTime()) / 86400000);
};

export const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} kg`;

export const occupancyLevel = (now: number, capacity: number | null) => {
  if (!capacity) return { label: now === 0 ? 'Vacío' : 'Abierto', pct: null as number | null };
  const pct = Math.min(100, Math.round((now / capacity) * 100));
  return { label: pct < 40 ? 'Tranquilo' : pct < 75 ? 'Moderado' : 'Lleno', pct };
};
