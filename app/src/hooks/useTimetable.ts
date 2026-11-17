import { useCallback, useEffect, useState } from 'react';
import {
  api,
  timetableSlots,
  type CourseStats,
  type LogStatus,
  type TimetableSlot,
  type TimetableSwap,
  type TodaySlot,
} from '@/lib/api';
import { buildSwapMap } from '@/lib/timetable';

export interface UseTimetableOptions {
  /** Called after any attendance log so parent stats can refresh. */
  onAttendanceLogged?: () => void;
}

export function useTimetable(courses: CourseStats[], options: UseTimetableOptions = {}) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [swaps, setSwaps] = useState<TimetableSwap[]>([]);
  const [today, setToday] = useState<TodaySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const [slotData, swapData, todayData] = await Promise.all([
      api.getTimetable(),
      api.getSwaps(),
      api.getToday(),
    ]);
    setSlots(slotData);
    setSwaps(swapData);
    setToday(todayData);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [slotData, swapData, todayData] = await Promise.all([
          api.getTimetable(),
          api.getSwaps(),
          api.getToday(),
        ]);
        if (cancelled) return;
        setSlots(slotData);
        setSwaps(swapData);
        setToday(todayData);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load timetable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Runs an action, surfaces failures as actionError, then refreshes the grid. */
  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(null);
      setBusy(true);
      try {
        await action();
        await refetch();
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Action failed');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refetch],
  );

  const place = useCallback(
    (courseId: string, dayOfWeek: number, slotIndex: number) =>
      runAction(() => api.placeSlot({ courseId, dayOfWeek, slotIndex })),
    [runAction],
  );

  const move = useCallback(
    (slotId: string, dayOfWeek: number, slotIndex: number) =>
      runAction(() => api.moveSlot(slotId, { dayOfWeek, slotIndex })),
    [runAction],
  );

  /** Removes a slot from the base grid; reverts its weekly swap first, if any. */
  const unassign = useCallback(
    (slotId: string) => {
      const swapMap = buildSwapMap(swaps);
      const swap = swapMap.get(slotId);
      return runAction(async () => {
        if (swap) await api.toggleSwap(swap.slotAId, swap.slotBId);
        await api.removeSlot(slotId);
      });
    },
    [runAction, swaps],
  );

  const setVenue = useCallback(
    (slotId: string, venue: string | null) =>
      runAction(() => api.updateSlot(slotId, { venue })),
    [runAction],
  );

  const toggleCancelled = useCallback(
    (slotId: string, isCancelled: boolean) =>
      runAction(() => api.updateSlot(slotId, { isCancelled })),
    [runAction],
  );

  /** Creating for an already-swapped pair reverts it (server handles the toggle). */
  const toggleSwap = useCallback(
    (slotAId: string, slotBId: string) =>
      runAction(() => api.toggleSwap(slotAId, slotBId)),
    [runAction],
  );

  /** Logs attendance for the module effectively running a period this week. */
  const logForCell = useCallback(
    (courseId: string, slotIndex: number, status: LogStatus, reason?: string) => {
      const slotTime = timetableSlots.find((s) => s.index === slotIndex)?.startTime;
      return runAction(async () => {
        await api.logAttendance(courseId, status, reason, { slotTime });
        options.onAttendanceLogged?.();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runAction, options.onAttendanceLogged],
  );

  return {
    courses,
    slots,
    swaps,
    today,
    swapMap: buildSwapMap(swaps),
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    busy,
    refetch,
    place,
    move,
    unassign,
    setVenue,
    toggleCancelled,
    toggleSwap,
    logForCell,
  };
}

export type TimetableController = ReturnType<typeof useTimetable>;
