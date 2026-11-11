import { Router, json } from 'express';
import { query } from '../db.js';
import type { CourseRow, AttendanceLogRow } from '../types.js';

const router = Router();
router.use(json());

const STATUSES = ['ATTENDED', 'SKIPPED', 'CANCELLED'] as const;
type LogStatus = (typeof STATUSES)[number];

router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await query<AttendanceLogRow>(
      'SELECT * FROM attendance_logs WHERE course_id = $1 ORDER BY log_date DESC, created_at DESC',
      [req.params.id],
    );
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/logs', async (req, res, next) => {
  try {
    const { status, reason, logDate } = req.body as { status?: string; reason?: string; logDate?: string };

    if (!status || !STATUSES.includes(status as LogStatus)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    const date = logDate && /^\d{4}-\d{2}-\d{2}$/.test(logDate) ? logDate : new Date().toISOString().slice(0, 10);

    const [course] = await query<CourseRow>('SELECT id FROM courses WHERE id = $1', [req.params.id]);
    if (!course) return res.status(404).json({ error: 'course not found' });

    const [log] = await query<AttendanceLogRow>(
      `INSERT INTO attendance_logs (course_id, log_date, status, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (course_id, log_date) DO UPDATE
         SET status = EXCLUDED.status,
             reason = EXCLUDED.reason
       RETURNING *`,
      [req.params.id, date, status, reason?.trim() || null],
    );
    res.json(log);
  } catch (err) {
    next(err);
  }
});

export default router;
