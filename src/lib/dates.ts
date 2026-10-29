/**
 * Local calendar dates as ISO strings (YYYY-MM-DD, local time, no time zone shifts). Weeks start on Monday;
 * weekday index 0 = lundi … 6 = dimanche. French labels (Halo « Formats (français) »: « 12 mars », « 04 oct. 2026 »).
 */

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIso(iso: ISODate): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): ISODate {
  return toIso(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(iso: ISODate): number {
  return (fromIso(iso).getDay() + 6) % 7;
}

/** Monday of the week that contains `iso`. */
export function weekStart(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

export function weekDays(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: ISODate): ISODate {
  const d = fromIso(monthStart(iso));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toIso(d);
}

export function yearStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-01-01`;
}

export function yearEnd(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-12-31`;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const DAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
export const DAY_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const MONTH_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « vendredi 24 octobre » */
export function longDate(iso: ISODate): string {
  const d = fromIso(iso);
  return `${DAY_LONG[weekdayIndex(iso)]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}

/** « 24 oct. » (+ year when it is not the current one) */
export function shortDate(iso: ISODate): string {
  const d = fromIso(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}${year}`;
}

/** « oct. » */
export function monthShort(iso: ISODate): string {
  return MONTH_SHORT[fromIso(iso).getMonth()]!;
}

/** « octobre 2026 » */
export function monthLabel(iso: ISODate): string {
  const d = fromIso(iso);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 20 – 26 oct. » or « 27 oct. – 2 nov. » */
export function weekRangeLabel(start: ISODate): string {
  const a = fromIso(start);
  const b = fromIso(addDays(start, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
}

/** « aujourd'hui », « demain », « hier », or « lundi 27 » */
export function relativeDay(iso: ISODate, today = todayIso()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  if (diff === -1) return 'hier';
  return `${DAY_LONG[weekdayIndex(iso)]} ${fromIso(iso).getDate()}`;
}
