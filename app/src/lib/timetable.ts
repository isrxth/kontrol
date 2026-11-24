import { timetableSlots, type TimetableCourseInfo, type TimetableSlot, type TimetableSwap } from './api';
import { parseDateOnly } from './dates';

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(): string {
  return toDateOnly(new Date());
}

export function todayMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** ISO day: 1 = Monday ... 7 = Sunday */
export function dayOfWeekOf(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - (dayOfWeekOf(d) - 1));
  return toDateOnly(d);
}

export type DragPayload =
  | { kind: 'course'; courseId: string }
  | { kind: 'slot'; slotId: string; courseId: string };

export function dragIdForCourse(courseId: string): string {
  return `course:${courseId}`;
}

export function dragIdForSlot(slot: TimetableSlot, course: TimetableCourseInfo): string {
  return `slot:${slot.id}:${course.id}`;
}

export function parseDragId(id: string): DragPayload | null {
  const [kind, a, b] = id.split(':');
  if (kind === 'course' && a) return { kind: 'course', courseId: a };
  if (kind === 'slot' && a && b) return { kind: 'slot', slotId: a, courseId: b };
  return null;
}

export function cellDroppableId(dayOfWeek: number, slotIndex: number): string {
  return `cell:${dayOfWeek}:${slotIndex}`;
}

export function parseCellDroppableId(id: string): { dayOfWeek: number; slotIndex: number } | null {
  const [kind, day, index] = id.split(':');
  if (kind !== 'cell' || !day || !index) return null;
  return { dayOfWeek: Number(day), slotIndex: Number(index) };
}

export interface SwapPartner {
  slotId: string;
  dayOfWeek: number;
  startTime: string;
  code: string;
  name: string;
}

/** slotId -> the swap it participates in this week */
export function buildSwapMap(swaps: TimetableSwap[]): Map<string, TimetableSwap> {
  const map = new Map<string, TimetableSwap>();
  for (const s of swaps) {
    map.set(s.slotAId, s);
    map.set(s.slotBId, s);
  }
  return map;
}

export function swapPartnerOf(slotId: string, swap: TimetableSwap): SwapPartner {
  return swap.slotAId === slotId
    ? { slotId: swap.slotBId, dayOfWeek: swap.b.dayOfWeek, startTime: swap.b.startTime, code: swap.b.code, name: swap.b.name }
    : { slotId: swap.slotAId, dayOfWeek: swap.a.dayOfWeek, startTime: swap.a.startTime, code: swap.a.code, name: swap.a.name };
}

export interface EffectiveCell {
  slot: TimetableSlot;
  /** The module that actually runs in this cell this week (swap-aware). */
  course: TimetableCourseInfo;
  /** Present when a weekly swap puts a foreign module in this cell. */
  swappedWith: { dayOfWeek: number; startTime: string; code: string } | null;
  /** The slot row that owns the displayed module on the base grid. */
  baseSlotId: string;
}

export function resolveCell(slot: TimetableSlot, swapMap: Map<string, TimetableSwap>): EffectiveCell {
  const swap = swapMap.get(slot.id);
  if (!swap) {
    return { slot, course: slot.course, swappedWith: null, baseSlotId: slot.id };
  }
  const partner = swapPartnerOf(slot.id, swap);
  const partnerCourse = partner.slotId === swap.slotAId
    ? { id: swap.a.courseId, code: swap.a.code, name: swap.a.name }
    : { id: swap.b.courseId, code: swap.b.code, name: swap.b.name };
  return {
    slot,
    course: partnerCourse,
    swappedWith: { dayOfWeek: partner.dayOfWeek, startTime: partner.startTime, code: partner.code },
    baseSlotId: partner.slotId,
  };
}

export interface GridCell {
  dayOfWeek: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
  slot: TimetableSlot | null;
  cell: EffectiveCell | null;
}

export function buildGrid(slots: TimetableSlot[], swapMap: Map<string, TimetableSwap>): GridCell[][] {
  const byPosition = new Map<string, TimetableSlot>();
  for (const slot of slots) {
    const def = timetableSlots.find((s) => s.startTime === slot.startTime);
    if (def) byPosition.set(`${slot.dayOfWeek}:${def.index}`, slot);
  }

  return timetableSlots.map((def) =>
    Array.from({ length: 5 }, (_, i) => {
      const dayOfWeek = i + 1;
      const slot = byPosition.get(`${dayOfWeek}:${def.index}`) ?? null;
      return {
        dayOfWeek,
        slotIndex: def.index,
        startTime: def.startTime,
        endTime: def.endTime,
        slot,
        cell: slot ? resolveCell(slot, swapMap) : null,
      };
    }),
  );
}

export function unplacedCourses<T extends { id: string }>(courses: T[], slots: TimetableSlot[], swapMap: Map<string, TimetableSwap>): T[] {
  const placed = new Set<string>();
  for (const slot of slots) {
    const cell = resolveCell(slot, swapMap);
    placed.add(slot.courseId);
    placed.add(cell.course.id);
  }
  return courses.filter((c) => !placed.has(c.id));
}

/** Monday (YYYY-MM-DD) of the week `offset` weeks from `date`'s week. */
export function weekStartOf(date: Date, offset: number): string {
  const base = mondayOf(date);
  const d = parseDateOnly(base);
  if (!d) return base;
  d.setDate(d.getDate() + offset * 7);
  return toDateOnly(d);
}

/** Calendar date (YYYY-MM-DD) for a given ISO dayOfWeek (1=Mon..5=Fri) within a week starting on `weekStart`. */
export function dateForDay(weekStart: string, dayOfWeek: number): string {
  const d = parseDateOnly(weekStart);
  if (!d) return weekStart;
  d.setDate(d.getDate() + (dayOfWeek - 1));
  return toDateOnly(d);
}

/** Format a 'YYYY-MM-DD' as 'Mon 23' for day column headers. */
export function formatDayHeader(value: string): string {
  const d = parseDateOnly(value);
  if (!d) return value;
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

/** Format a week range as 'Nov 23 – Nov 27'. */
export function formatWeekRange(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return `${startDate} – ${endDate}`;
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return sameMonth ? `${fmt(start)} – ${fmt(end)}` : `${fmt(start)} – ${fmt(end)}`;
}

/** Format a 'YYYY-MM-DD' as 'Monday, Nov 23' for action sheet headers. */
export function formatDayFull(value: string): string {
  const d = parseDateOnly(value);
  if (!d) return value;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
