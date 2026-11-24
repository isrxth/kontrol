import { useCallback, useEffect, useState } from 'react';
import { api, type CourseStats, type LogStatus, type NewCourseInput } from '@/lib/api';
import { CACHE_KEYS, getCached, applyOptimisticAttendance } from '@/lib/offline-store';

export function useCourses() {
  const [courses, setCourses] = useState<CourseStats[]>(
    () => getCached<CourseStats[]>(CACHE_KEYS.courses) ?? []
  );
  const [loading, setLoading] = useState(
    () => !getCached<CourseStats[]>(CACHE_KEYS.courses)
  );
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getCourseStats();
      setCourses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await api.getCourseStats();
        if (!cancelled) {
          setCourses(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load courses');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    const handleExternalUpdate = () => {
      void run();
    };
    const handleOptimisticUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ courses: CourseStats[] }>;
      if (custom.detail?.courses) {
        setCourses(custom.detail.courses);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kontrol:attendance-updated', handleExternalUpdate);
      window.addEventListener('kontrol:courses-optimistic', handleOptimisticUpdate);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('kontrol:attendance-updated', handleExternalUpdate);
        window.removeEventListener('kontrol:courses-optimistic', handleOptimisticUpdate);
      }
    };
  }, []);

  const logAttendance = useCallback(async (courseId: string, status: LogStatus, reason?: string) => {
    applyOptimisticAttendance(courseId, status);
    // Sync to Supabase silently in the background; optimistic state is the
    // primary device source of truth.
    void api.logAttendance(courseId, status, reason).then(
      () => void fetchStats(),
      () => {} // network error handled by offline outbox
    );
  }, [fetchStats]);

  const addCourse = useCallback(async (input: NewCourseInput) => {
    await api.createCourse(input);
    await fetchStats();
  }, [fetchStats]);

  return { courses, loading, error, refetch: fetchStats, logAttendance, addCourse };
}
