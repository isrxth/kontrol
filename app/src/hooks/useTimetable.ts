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
import { CACHE_KEYS, getCached, setCached } from '@/lib/offline-store';

export interface UseTimetableOptions {
  /** Called after any attendance log so parent stats can refresh. */
  onAttendanceLogged?: () => void;
}

export function useTimetable(courses: CourseStats[], options: UseTimetableOptions = {}) {
  const [slots, setSlots] = useState<TimetableSlot[]>(
    () => getCached<TimetableSlot[]>(CACHE_KEYS.timetable) ?? []
  );
  const [swaps, setSwaps] = useState<TimetableSwap[]>(
    () => getCached<TimetableSwap[]>(CACHE_KEYS.swaps) ?? []
  );
  const [today, setToday] = useState<TodaySlot[]>(
    () => getCached<TodaySlot[]>(CACHE_KEYS.today) ?? []
  );
  const [loading, setLoading] = useState(
    () => !getCached<TimetableSlot[]>(CACHE_KEYS.timetable)
  );
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

  /**
   * Optimistic mutation helper. Applies `mutator` to state + localStorage
   * synchronously, then fires `action()` in the background. If the server
   * returns a 4xx (thrown by api.request), the snapshot is reverted. Network
   * errors are already absorbed by api.request (outbox enqueue) so the
   * optimistic state is preserved.
   */
  const runOptimistic = useCallback(
    async (
      mutator: () => void,
      action: () => Promise<unknown>,
      cacheKeys: string[]
    ) => {
      const prevSlots = [...slots];
      const prevSwaps = [...swaps];

      setBusy(true);
      mutator();

      try {
        await action();
        // Silent background revalidation: reconcile with server without
        // showing a loading spinner.
        void refetch();
      } catch (err) {
        // 4xx server error: revert to previous snapshot
        setSlots(prevSlots);
        setSwaps(prevSwaps);
        for (const key of cacheKeys) {
          if (key === CACHE_KEYS.timetable) setCached(key, prevSlots);
          if (key === CACHE_KEYS.swaps) setCached(key, prevSwaps);
        }
        setActionError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [slots, swaps, refetch]
  );

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
    (courseId: string, dayOfWeek: number, slotIndex: number) => {
      const def = timetableSlots.find((s) => s.index === slotIndex);
      if (!def) return;

      const course = courses.find((c) => c.id === courseId);
      const tempId = `opt_place_${Date.now()}`;
      const newSlot: TimetableSlot = {
        id: tempId,
        courseId,
        dayOfWeek,
        startTime: def.startTime,
        endTime: def.endTime,
        venue: null,
        isCancelled: false,
        course: course
          ? { id: course.id, code: course.code, name: course.name }
          : { id: courseId, code: '', name: '' },
      };

      const mutator = () => {
        setSlots([...slots, newSlot]);
        setCached(CACHE_KEYS.timetable, [...slots, newSlot]);
      };

      void runOptimistic(
        mutator,
        () => api.placeSlot({ courseId, dayOfWeek, slotIndex }),
        [CACHE_KEYS.timetable]
      );
    },
    [courses, slots, runOptimistic]
  );

  const move = useCallback(
    (slotId: string, dayOfWeek: number, slotIndex: number) => {
      const def = timetableSlots.find((s) => s.index === slotIndex);
      if (!def) return;

      const mutator = () => {
        const next = slots.map((s) =>
          s.id === slotId ? { ...s, dayOfWeek, startTime: def.startTime, endTime: def.endTime } : s
        );
        setSlots(next);
        setCached(CACHE_KEYS.timetable, next);
      };

      void runOptimistic(
        mutator,
        () => api.moveSlot(slotId, { dayOfWeek, slotIndex }),
        [CACHE_KEYS.timetable]
      );
    },
    [slots, runOptimistic]
  );

  /** Removes a slot from the base grid; reverts its weekly swap first, if any. */
  const unassign = useCallback(
    (slotId: string) => {
      const swapMap = buildSwapMap(swaps);
      const swap = swapMap.get(slotId);

      const mutator = () => {
        let next = slots.filter((s) => s.id !== slotId);
        setSlots(next);
        setCached(CACHE_KEYS.timetable, next);
        if (swap) {
          const nextSwaps = swaps.filter((s) => s.id !== swap.id);
          setSwaps(nextSwaps);
          setCached(CACHE_KEYS.swaps, nextSwaps);
        }
      };

      void runOptimistic(
        mutator,
        async () => {
          if (swap) await api.toggleSwap(swap.slotAId, swap.slotBId);
          await api.removeSlot(slotId);
        },
        [CACHE_KEYS.timetable, CACHE_KEYS.swaps]
      );
    },
    [slots, swaps, runOptimistic]
  );

  const setVenue = useCallback(
    (slotId: string, venue: string | null) => {
      const mutator = () => {
        const next = slots.map((s) =>
          s.id === slotId ? { ...s, venue: venue ?? null } : s
        );
        setSlots(next);
        setCached(CACHE_KEYS.timetable, next);
      };

      void runOptimistic(
        mutator,
        () => api.updateSlot(slotId, { venue }),
        [CACHE_KEYS.timetable]
      );
    },
    [slots, runOptimistic]
  );

  const toggleCancelled = useCallback(
    (slotId: string, isCancelled: boolean) => {
      const mutator = () => {
        const next = slots.map((s) =>
          s.id === slotId ? { ...s, isCancelled } : s
        );
        setSlots(next);
        setCached(CACHE_KEYS.timetable, next);
      };

      void runOptimistic(
        mutator,
        () => api.updateSlot(slotId, { isCancelled }),
        [CACHE_KEYS.timetable]
      );
    },
    [slots, runOptimistic]
  );

  /** Creating for an already-swapped pair reverts it (server handles the toggle). */
  const toggleSwap = useCallback(
    (slotAId: string, slotBId: string) => {
      const mutator = () => {
        const existing = swaps.find(
          (s) => (s.slotAId === slotAId && s.slotBId === slotBId) || (s.slotAId === slotBId && s.slotBId === slotAId)
        );
        if (existing) {
          setSwaps(swaps.filter((s) => s.id !== existing.id));
        } else {
          const tempId = `opt_swap_${Date.now()}`;
          setSwaps([
            ...swaps,
            {
              id: tempId,
              weekStart: '',
              slotAId,
              slotBId,
              createdAt: '',
              a: { slotId: slotAId, courseId: '', dayOfWeek: 1, startTime: '', code: '', name: '' },
              b: { slotId: slotBId, courseId: '', dayOfWeek: 1, startTime: '', code: '', name: '' },
            },
          ]);
        }
        setCached(CACHE_KEYS.swaps, [...swaps]);
      };

      void runOptimistic(
        mutator,
        () => api.toggleSwap(slotAId, slotBId),
        [CACHE_KEYS.swaps]
      );
    },
    [swaps, runOptimistic]
  );

  /** Logs attendance for the module effectively running a period this week. */
  const logForCell = useCallback(
    (courseId: string, slotIndex: number, status: LogStatus, reason?: string, logDate?: string) => {
      const slotTime = timetableSlots.find((s) => s.index === slotIndex)?.startTime;
      return runAction(async () => {
        await api.logAttendance(courseId, status, reason, { logDate, slotTime });
        options.onAttendanceLogged?.();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runAction, options.onAttendanceLogged]
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
