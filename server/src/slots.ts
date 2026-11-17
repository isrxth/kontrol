export interface SlotDefinition {
  index: number;
  label: string;
  startTime: string;
  endTime: string;
}

/** Fixed class periods for the Mon-Fri grid. The noon break (12:30-13:15) is visual only. */
export const SLOTS: readonly SlotDefinition[] = [
  { index: 1, label: '08:15 - 10:15', startTime: '08:15', endTime: '10:15' },
  { index: 2, label: '10:30 - 12:30', startTime: '10:30', endTime: '12:30' },
  { index: 3, label: '13:15 - 15:15', startTime: '13:15', endTime: '15:15' },
  { index: 4, label: '15:30 - 17:30', startTime: '15:30', endTime: '17:30' },
];

export const NOON_BREAK = { startTime: '12:30', endTime: '13:15' } as const;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 'HH:MM:SS' (as pg returns TIME) -> 'HH:MM' */
export function normalizeTime(value: string): string {
  return value.length === 8 ? value.slice(0, 5) : value;
}

export function findSlotByStart(startTime: string): SlotDefinition | undefined {
  const t = normalizeTime(startTime);
  return SLOTS.find((s) => s.startTime === t);
}
