export interface CourseRow {
  id: string;
  code: string;
  name: string;
  credits: number;
  total_lectures: number;
  required_ratio: number;
  created_at: string;
}

export interface CourseStatsRow extends CourseRow {
  attended_count: number;
  skipped_count: number;
  cancelled_count: number;
}

export interface RiskInfo {
  maxSafeSkips: number;
  remainingSkips: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  attendancePercentage: number;
}

export function calculateRisk(totalLectures: number, requiredRatio: number, skippedCount: number, attendedCount: number): RiskInfo {
  const maxSafeSkips = Math.floor(totalLectures * (1 - requiredRatio));
  const remainingSkips = maxSafeSkips - skippedCount;

  let riskLevel: RiskInfo['riskLevel'] = 'SAFE';
  if (remainingSkips < 0) riskLevel = 'DANGER';
  else if (remainingSkips <= 1) riskLevel = 'WARNING';

  const sessionsHeld = attendedCount + skippedCount;
  const attendancePercentage = sessionsHeld > 0
    ? Math.round((attendedCount / sessionsHeld) * 100)
    : 100;

  return { maxSafeSkips, remainingSkips, riskLevel, attendancePercentage };
}

export interface TimetableSlotRow {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  is_cancelled: boolean;
}

export interface TimetableSlotDetailRow extends TimetableSlotRow {
  course_code: string;
  course_name: string;
}

export interface TimetableSwapRow {
  id: string;
  week_start: string;
  slot_a: string;
  slot_b: string;
  created_at: string;
}

export interface AttendanceLogRow {
  id: string;
  course_id: string;
  log_date: string;
  slot_time: string | null;
  status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED';
  reason: string | null;
  created_at: string;
}

export type ProjectStatus = 'IDEA' | 'BUILDING' | 'SHIPPED' | 'PAUSED';
export type ProjectKind = 'PERSONAL' | 'COURSEWORK';

export interface ProjectRow {
  id: string;
  title: string;
  kind: ProjectKind;
  course_id: string | null;
  status: ProjectStatus;
  description: string | null;
  repo_url: string | null;
  live_url: string | null;
  tech_stack: string[] | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetailRow extends ProjectRow {
  course_code: string | null;
  done_task_count: number;
  total_task_count: number;
}

export interface ProjectTaskRow {
  id: string;
  project_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export type ActivityType = 'EXAM' | 'COURSEWORK' | 'EVENT' | 'OTHER';
export type ActivityPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ActivityRow {
  id: string;
  title: string;
  type: ActivityType;
  course_id: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: ActivityPriority;
  notes: string | null;
  is_done: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityDetailRow extends ActivityRow {
  course_code: string | null;
}
