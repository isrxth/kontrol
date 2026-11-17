export interface CourseStats {
  id: string;
  code: string;
  name: string;
  credits: number;
  totalLectures: number;
  requiredRatio: number;
  attendedCount: number;
  skippedCount: number;
  cancelledCount: number;
  maxSafeSkips: number;
  remainingSkips: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  attendancePercentage: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  totalLectures: number;
  requiredRatio: number;
  createdAt: string;
}

export interface AttendanceLog {
  id: string;
  courseId: string;
  logDate: string;
  slotTime: string | null;
  status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED';
  reason: string | null;
  createdAt: string;
}

export interface TimetableCourseInfo {
  id: string;
  code: string;
  name: string;
}

export interface TimetableSlot {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string | null;
  isCancelled: boolean;
  course: TimetableCourseInfo;
}

export interface TimetableSwap {
  id: string;
  weekStart: string;
  slotAId: string;
  slotBId: string;
  createdAt: string;
  a: { slotId: string; courseId: string; dayOfWeek: number; startTime: string; code: string; name: string };
  b: { slotId: string; courseId: string; dayOfWeek: number; startTime: string; code: string; name: string };
}

export interface TodaySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string | null;
  isCancelled: boolean;
  course: TimetableCourseInfo;
  swappedWith: { dayOfWeek: number; startTime: string; code: string } | null;
  logStatus: 'ATTENDED' | 'SKIPPED' | 'CANCELLED' | null;
}

export interface NewCourseInput {
  code: string;
  name: string;
  totalLectures: number;
  requiredRatio?: number;
  credits?: number;
}

export type LogStatus = 'ATTENDED' | 'SKIPPED' | 'CANCELLED';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  getCourseStats: () => request<CourseStats[]>('/courses/stats'),

  getCourse: (id: string) => request<Course>(`/courses/${id}`),

  createCourse: (input: NewCourseInput) =>
    request<Course>('/courses', { method: 'POST', body: JSON.stringify(input) }),

  getLogs: (courseId: string) => request<AttendanceLog[]>(`/courses/${courseId}/logs`),

  logAttendance: (courseId: string, status: LogStatus, reason?: string, options?: { logDate?: string; slotTime?: string }) =>
    request<AttendanceLog>(`/courses/${courseId}/logs`, {
      method: 'POST',
      body: JSON.stringify({ status, reason, logDate: options?.logDate, slotTime: options?.slotTime }),
    }),

  getTimetable: () => request<TimetableSlot[]>('/timetable'),

  placeSlot: (input: { courseId: string; dayOfWeek: number; slotIndex: number; venue?: string | null }) => {
    const def = slotByIndex(input.slotIndex);
    return request<TimetableSlot>('/timetable', {
      method: 'POST',
      body: JSON.stringify({
        courseId: input.courseId,
        dayOfWeek: input.dayOfWeek,
        startTime: def.startTime,
        endTime: def.endTime,
        venue: input.venue ?? null,
      }),
    });
  },

  moveSlot: (slotId: string, input: { dayOfWeek: number; slotIndex: number }) => {
    const def = slotByIndex(input.slotIndex);
    return request<TimetableSlot>(`/timetable/slots/${slotId}`, {
      method: 'PUT',
      body: JSON.stringify({ dayOfWeek: input.dayOfWeek, startTime: def.startTime }),
    });
  },

  updateSlot: (slotId: string, input: { venue?: string | null; isCancelled?: boolean }) =>
    request<TimetableSlot>(`/timetable/slots/${slotId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  removeSlot: (slotId: string) =>
    request<void>(`/timetable/slots/${slotId}`, { method: 'DELETE' }),

  toggleSwap: (slotAId: string, slotBId: string, weekStart?: string) =>
    request<{ action: 'created' | 'reverted'; swapId?: string }>('/timetable/swaps', {
      method: 'POST',
      body: JSON.stringify({ slotAId, slotBId, weekStart }),
    }),

  getSwaps: (weekStart?: string) => {
    const query = weekStart ? `?week=${encodeURIComponent(weekStart)}` : '';
    return request<TimetableSwap[]>(`/timetable/swaps${query}`);
  },

  getToday: (date?: string) =>
    request<TodaySlot[]>(`/timetable/today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
};

// Fixed class periods, mirroring server/src/slots.ts
export const timetableSlots = [
  { index: 1, label: '08:15 - 10:15', startTime: '08:15', endTime: '10:15' },
  { index: 2, label: '10:30 - 12:30', startTime: '10:30', endTime: '12:30' },
  { index: 3, label: '13:15 - 15:15', startTime: '13:15', endTime: '15:15' },
  { index: 4, label: '15:30 - 17:30', startTime: '15:30', endTime: '17:30' },
] as const;

export const noonBreak = { startTime: '12:30', endTime: '13:15' } as const;

function slotByIndex(index: number) {
  const def = timetableSlots.find((s) => s.index === index);
  if (!def) throw new Error(`Unknown slot index: ${index}`);
  return def;
}
