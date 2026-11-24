import { useState, useEffect } from 'react';
import { BASE, getAuthToken, type CourseStats, type LogStatus } from './api';

export const CACHE_KEYS = {
  courses: 'kontrol_cache_courses',
  timetable: 'kontrol_cache_timetable',
  swaps: 'kontrol_cache_swaps',
  today: 'kontrol_cache_today',
  projects: 'kontrol_cache_projects',
  activities: 'kontrol_cache_activities',
  holidays: 'kontrol_cache_holidays',
  weekOffset: 'kontrol_cache_week_offset',
} as const;

export const OUTBOX_KEY = 'kontrol_offline_outbox';

export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota exceeded or private mode
  }
}

export interface OutboxItem {
  id: string;
  method: string;
  path: string;
  body?: any;
  createdAt: number;
  description?: string;
}

export function getOutbox(): OutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('kontrol:outbox-updated', { detail: { count: items.length } }));
  } catch {
    // ignore
  }
}

export function enqueueOutbox(item: Omit<OutboxItem, 'id' | 'createdAt'>): OutboxItem {
  const current = getOutbox();
  const newItem: OutboxItem = {
    ...item,
    id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  current.push(newItem);
  saveOutbox(current);
  return newItem;
}

export function removeOutbox(id: string): void {
  const current = getOutbox();
  const filtered = current.filter((item) => item.id !== id);
  saveOutbox(filtered);
}

export function clearOutbox(): void {
  saveOutbox([]);
}

let isFlushing = false;

export async function flushOutbox(): Promise<void> {
  if (typeof window === 'undefined' || isFlushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const items = getOutbox();
  if (items.length === 0) return;

  isFlushing = true;
  window.dispatchEvent(new CustomEvent('kontrol:outbox-syncing', { detail: { syncing: true } }));

  try {
    for (const item of items) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${BASE}${item.path}`, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
          credentials: 'include',
        });

        if (res.ok || res.status === 204) {
          removeOutbox(item.id);
        } else if (res.status === 401) {
          // Token expired or invalid, stop processing until re-auth
          break;
        } else if (res.status >= 400 && res.status < 500) {
          // Client error that won't succeed on retry, discard
          removeOutbox(item.id);
        } else {
          // Server error / network failure, keep in queue and stop this flush cycle
          break;
        }
      } catch {
        // Network error while executing, stop flush
        break;
      }
    }
  } finally {
    isFlushing = false;
    window.dispatchEvent(new CustomEvent('kontrol:outbox-syncing', { detail: { syncing: false } }));
    const remaining = getOutbox();
    if (remaining.length === 0) {
      window.dispatchEvent(new CustomEvent('kontrol:outbox-synced'));
      window.dispatchEvent(new CustomEvent('kontrol:attendance-updated'));
    }
  }
}

// Auto-flush listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox();
  });
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
      void flushOutbox();
    }
  });
}

/**
 * Optimistically updates course attendance in local snapshot
 */
export function applyOptimisticAttendance(courseId: string, status: LogStatus): CourseStats[] | null {
  const courses = getCached<CourseStats[]>(CACHE_KEYS.courses);
  if (!courses) return null;

  const updated = courses.map((c) => {
    if (c.id !== courseId) return c;
    const attended = c.attendedCount + (status === 'ATTENDED' ? 1 : 0);
    const skipped = c.skippedCount + (status === 'SKIPPED' ? 1 : 0);
    const ghost = c.ghostCount + (status === 'GHOST' ? 1 : 0);
    const cancelled = c.cancelledCount + (status === 'CANCELLED' ? 1 : 0);
    const held = attended + skipped + ghost;
    const attendancePercentage = held > 0 ? Math.round(((attended + ghost) / held) * 100) : 100;

    // Remaining safe skips: ((attended + ghost) - requiredRatio * held) / requiredRatio
    const ratio = c.requiredRatio || 0.8;
    const remainingSkips = Math.max(0, Math.floor((attended + ghost - ratio * held) / ratio));

    const riskLevel: 'SAFE' | 'WARNING' | 'DANGER' =
      remainingSkips <= 0 ? 'DANGER' : remainingSkips <= 2 ? 'WARNING' : 'SAFE';

    return {
      ...c,
      attendedCount: attended,
      skippedCount: skipped,
      ghostCount: ghost,
      cancelledCount: cancelled,
      attendancePercentage,
      remainingSkips,
      riskLevel,
    };
  });

  setCached(CACHE_KEYS.courses, updated);
  window.dispatchEvent(new CustomEvent('kontrol:courses-optimistic', { detail: { courses: updated } }));
  return updated;
}

/**
 * Hook to inspect the offline & outbox sync state
 */
export function useOutboxStatus() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(() => getOutbox().length);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleOutboxUpdated = () => setPendingCount(getOutbox().length);
    const handleSyncing = (e: Event) => {
      const custom = e as CustomEvent<{ syncing: boolean }>;
      setIsSyncing(Boolean(custom.detail?.syncing));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('kontrol:outbox-updated', handleOutboxUpdated);
    window.addEventListener('kontrol:outbox-synced', handleOutboxUpdated);
    window.addEventListener('kontrol:outbox-syncing', handleSyncing);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('kontrol:outbox-updated', handleOutboxUpdated);
      window.removeEventListener('kontrol:outbox-synced', handleOutboxUpdated);
      window.removeEventListener('kontrol:outbox-syncing', handleSyncing);
    };
  }, []);

  return { isOffline, pendingCount, isSyncing, flush: flushOutbox };
}
