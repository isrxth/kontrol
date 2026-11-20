function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(): string {
  return toDateOnly(new Date());
}

/** Parse 'YYYY-MM-DD' safely into a local midnight Date. Returns null on invalid input. */
export function parseDateOnly(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Format a 'YYYY-MM-DD' date like 'Thu, 20 Nov 2026'. */
export function formatLogDate(value: string): string {
  const d = parseDateOnly(value);
  if (!d) return value;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
