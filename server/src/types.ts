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
  venue: string;
  is_cancelled: boolean;
}

export interface AttendanceLogRow {
  id: string;
  course_id: string;
  log_date: string;
  status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED';
  reason: string | null;
  created_at: string;
}
