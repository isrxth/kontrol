import { Router, json } from 'express';
import { query } from '../db.js';
import type { AttendanceLogRow, CourseRow } from '../types.js';
import { DATE_PATTERN, TIME_PATTERN, normalizeTime } from '../slots.js';
import { dayOfWeekOf, mondayOf, parseDate, dateOnly, todayLocal, isValidDateOnly } from '../dates.js';

const router = Router();
router.use(json());

const STATUSES = ['ATTENDED', 'SKIPPED', 'CANCELLED', 'GHOST'] as const;
type LogStatus = (typeof STATUSES)[number];

function toLogDto(row: AttendanceLogRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    logDate: dateOnly(row.log_date),
    slotTime: row.slot_time ? normalizeTime(row.slot_time) : null,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await query<AttendanceLogRow>(
      'SELECT * FROM attendance_logs WHERE course_id = $1 ORDER BY log_date DESC, created_at DESC',
      [req.params.id],
    );
    res.json(logs.map(toLogDto));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/logs', async (req, res, next) => {
  try {
    const { status, reason, logDate, slotTime } = req.body as {
      status?: string;
      reason?: string;
      logDate?: string;
      slotTime?: string;
    };

    if (!status || !STATUSES.includes(status as LogStatus)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    const date = logDate && DATE_PATTERN.test(logDate) && isValidDateOnly(logDate)
      ? logDate
      : todayLocal();

    let slot: string | null = null;
    if (slotTime !== undefined && slotTime !== null) {
      if (typeof slotTime !== 'string' || !TIME_PATTERN.test(slotTime)) {
        return res.status(400).json({ error: 'slotTime must be in HH:MM format' });
      }
      slot = normalizeTime(slotTime);
    }

    const [course] = await query<CourseRow>('SELECT id FROM courses WHERE id = $1', [req.params.id]);
    if (!course) return res.status(404).json({ error: 'course not found' });

    // A slot-context log requires the module to actually sit in that period on
    // that date, either on the base grid or via that week's swap overrides.
    if (slot) {
      const dow = dayOfWeekOf(parseDate(date));
      const week = mondayOf(parseDate(date));
      const [occupies] = await query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM timetable_slots
           WHERE course_id = $1 AND day_of_week = $2 AND start_time = $3
         ) OR EXISTS (
           SELECT 1
           FROM timetable_swaps s
           JOIN timetable_slots pa ON pa.id = s.slot_a
           JOIN timetable_slots pb ON pb.id = s.slot_b
           WHERE s.week_start = $4
             AND ((pa.day_of_week = $2 AND pa.start_time = $3 AND pb.course_id = $1)
               OR (pb.day_of_week = $2 AND pb.start_time = $3 AND pa.course_id = $1))
         ) AS ok`,
        [req.params.id, dow, slot, week],
      );
      if (!occupies?.ok) {
        return res.status(409).json({ error: 'module is not scheduled in that slot on that date' });
      }
    }

    const [log] = await query<AttendanceLogRow>(
      `INSERT INTO attendance_logs (course_id, log_date, slot_time, status, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, log_date, slot_time) DO UPDATE
         SET status = EXCLUDED.status,
             reason = EXCLUDED.reason
       RETURNING *`,
      [req.params.id, date, slot, status, reason?.trim() || null],
    );
    res.json(toLogDto(log));
  } catch (err) {
    next(err);
  }
});

export default router;
