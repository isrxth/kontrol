import { useCallback, useEffect, useState } from 'react';
import { api, type CourseStats, type LogStatus, type NewCourseInput } from '@/lib/api';

export function useCourses() {
  const [courses, setCourses] = useState<CourseStats[]>([]);
  const [loading, setLoading] = useState(true);
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
    return () => {
      cancelled = true;
    };
  }, []);

  const logAttendance = useCallback(async (courseId: string, status: LogStatus, reason?: string) => {
    await api.logAttendance(courseId, status, reason);
    await fetchStats();
  }, [fetchStats]);

  const addCourse = useCallback(async (input: NewCourseInput) => {
    await api.createCourse(input);
    await fetchStats();
  }, [fetchStats]);

  return { courses, loading, error, refetch: fetchStats, logAttendance, addCourse };
}
