function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(): string {
  return toDateOnly(new Date());
}

/** 'YYYY-MM-DD' -> local Date at midnight. */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** ISO day: 1 = Monday ... 7 = Sunday */
export function dayOfWeekOf(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

/** 'YYYY-MM-DD' of the Monday of the week containing the given local date. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - (dayOfWeekOf(d) - 1));
  return toDateOnly(d);
}

/** Normalizes a pg DATE value (JS Date or string) to 'YYYY-MM-DD'. */
export function dateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return toDateOnly(value);
}

/** True when 'YYYY-MM-DD' is a real calendar date (rejects e.g. 2026-02-30). */
export function isValidDateOnly(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
