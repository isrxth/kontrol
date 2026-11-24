import { useCallback, useEffect, useState } from 'react';
import { api, type Activity, type NewActivityInput } from '@/lib/api';
import { CACHE_KEYS, getCached, setCached } from '@/lib/offline-store';
import { hapticSuccess } from '@/lib/haptics';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>(
    () => getCached<Activity[]>(CACHE_KEYS.activities) ?? []
  );
  const [loading, setLoading] = useState(
    () => !getCached<Activity[]>(CACHE_KEYS.activities)
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const data = await api.getActivities();
    setActivities(data);
    setCached(CACHE_KEYS.activities, data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kontrol:activities-updated', { detail: { activities: data } }));
    }
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await api.getActivities();
        if (!cancelled) {
          setActivities(data);
          setCached(CACHE_KEYS.activities, data);
          setError(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kontrol:activities-updated', { detail: { activities: data } }));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Optimistic mutation helper for activities. */
  const runOptimistic = useCallback(
    async (mutator: () => void, action: () => Promise<unknown>) => {
      const prev = [...activities];
      setBusy(true);
      mutator();
      setCached(CACHE_KEYS.activities, [...activities]);
      try {
        await action();
        void refetch();
      } catch (err) {
        setActivities(prev);
        setCached(CACHE_KEYS.activities, prev);
        setActionError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [activities, refetch]
  );

  const createActivity = useCallback(
    (input: NewActivityInput) => {
      const tempId = `opt_act_${Date.now()}`;
      const optimistic: Activity = {
        id: tempId,
        title: input.title,
        type: input.type,
        courseId: input.courseId ?? null,
        courseCode: null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        priority: input.priority ?? 'MEDIUM',
        notes: input.notes ?? null,
        isDone: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      void runOptimistic(
        () => setActivities([...activities, optimistic]),
        () => api.createActivity(input)
      );
    },
    [activities, runOptimistic]
  );

  const updateActivity = useCallback(
    async (id: string, input: Partial<NewActivityInput> & { isDone?: boolean }) => {
      if (input.isDone) {
        void hapticSuccess();
      }
      void runOptimistic(
        () => {
          setActivities(activities.map((a) =>
            a.id === id ? { ...a, ...input, updatedAt: new Date().toISOString() } : a
          ));
        },
        () => api.updateActivity(id, input)
      );
    },
    [activities, runOptimistic]
  );

  const deleteActivity = useCallback(
    (id: string) => {
      void runOptimistic(
        () => {
          setActivities(activities.filter((a) => a.id !== id));
        },
        () => api.deleteActivity(id)
      );
    },
    [activities, runOptimistic]
  );

  return {
    activities,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    busy,
    refetch,
    createActivity,
    updateActivity,
    deleteActivity,
  };
}

export type ActivitiesController = ReturnType<typeof useActivities>;
