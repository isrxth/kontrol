import { useCallback, useEffect, useState } from 'react';
import { api, type Activity, type NewActivityInput } from '@/lib/api';
import { CACHE_KEYS, getCached } from '@/lib/offline-store';
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

  const createActivity = useCallback(
    (input: NewActivityInput) => runAction(() => api.createActivity(input)),
    [runAction],
  );

  const updateActivity = useCallback(
    async (id: string, input: Partial<NewActivityInput> & { isDone?: boolean }) => {
      if (input.isDone) {
        void hapticSuccess();
      }
      return runAction(() => api.updateActivity(id, input));
    },
    [runAction],
  );

  const deleteActivity = useCallback(
    (id: string) => runAction(() => api.deleteActivity(id)),
    [runAction],
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
