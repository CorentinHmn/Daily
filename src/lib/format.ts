/**
 * French number formats (Halo « Formats (français) »): decimal comma, narrow no-break space before units and as the
 * thousands separator (« 12,4 km », « 72 % », « 18 420 kg »). U+202F is in the Poppins latin subset.
 */

const NNBSP = ' ';

export function num(value: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value).replace(/\s/g, NNBSP);
}

export function km(value: number): string {
  return `${num(value, value >= 100 ? 0 : 1)}${NNBSP}km`;
}

export function kg(value: number): string {
  return `${num(value, Number.isInteger(value) ? 0 : 1)}${NNBSP}kg`;
}

/** kg → « 8,4 t » */
export function tonnes(kgValue: number): string {
  return `${num(kgValue / 1000, 1)}${NNBSP}t`;
}

export function percent(ratio: number): string {
  return `${num(Math.round(ratio * 100))}${NNBSP}%`;
}

/** Minutes → « 45 min », « 1 h 05 ». */
export function duration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}${NNBSP}min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}${NNBSP}h${NNBSP}${String(rest).padStart(2, '0')}` : `${h}${NNBSP}h`;
}

/** Pace in min/km → « 5:42 /km ». */
export function pace(minutesPerKm: number): string {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) return '–';
  let m = Math.floor(minutesPerKm);
  let s = Math.round((minutesPerKm - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}${NNBSP}/km`;
}

/** Seconds → « 1:30 » (rest timer). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** « 2 séances », « 1 séance » */
export function plural(n: number, one: string, many: string): string {
  return `${num(n)}${NNBSP}${n > 1 ? many : one}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Lower case, no accents: for matching (« Œufs » → « oeufs »). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** « 52:30 » (mm:ss), « 1:05:00 » (h:mm:ss) or « 45 » (min) → minutes; null when unreadable. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().replace(/[hH]/, ':').split(/[:'"]/).filter((p) => p !== '').map(Number);
  if (parts.length === 0 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[0]! + parts[1]! / 60;
  return parts[0]! * 60 + parts[1]! + (parts[2] ?? 0) / 60;
}

/** Minutes → « 52:30 » or « 1:05:00 » (input value). */
export function durationInput(minutes: number): string {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
