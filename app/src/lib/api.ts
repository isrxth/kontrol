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
  status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED';
  reason: string | null;
  createdAt: string;
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

  logAttendance: (courseId: string, status: LogStatus, reason?: string) =>
    request<AttendanceLog>(`/courses/${courseId}/logs`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    }),
};
