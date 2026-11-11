import { Router, json } from 'express';
import { query } from '../db.js';
import type { CourseRow, TimetableSlotRow } from '../types.js';

const router = Router();
router.use(json());

router.get('/', async (_req, res, next) => {
  try {
    const slots = await query<TimetableSlotRow>(
      `SELECT t.* FROM timetable_slots t ORDER BY t.day_of_week ASC, t.start_time ASC`,
    );
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

router.get('/today', async (_req, res, next) => {
  try {
    const jsDay = new Date().getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const slots = await query<TimetableSlotRow>(
      `SELECT t.* FROM timetable_slots t
       WHERE t.day_of_week = $1 AND t.is_cancelled = FALSE
       ORDER BY t.start_time ASC`,
      [dayOfWeek],
    );
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { courseId, dayOfWeek, startTime, endTime, venue } = req.body as {
      courseId?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      venue?: string;
    };
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek ?? 0) < 1 || (dayOfWeek ?? 0) > 7) {
      return res.status(400).json({ error: 'dayOfWeek must be an integer 1-7 (Mon-Sun)' });
    }
    if (!startTime || !endTime || !/^\d{2}:\d{2}(:\d{2})?$/.test(startTime) || !/^\d{2}:\d{2}(:\d{2})?$/.test(endTime)) {
      return res.status(400).json({ error: 'startTime and endTime must be in HH:MM format' });
    }
    if (!venue?.trim()) return res.status(400).json({ error: 'venue is required' });

    const [course] = await query<CourseRow>('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (!course) return res.status(404).json({ error: 'course not found' });

    const [slot] = await query<TimetableSlotRow>(
      `INSERT INTO timetable_slots (course_id, day_of_week, start_time, end_time, venue)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [courseId, dayOfWeek, startTime.length === 5 ? `${startTime}:00` : startTime,
        endTime.length === 5 ? `${endTime}:00` : endTime, venue.trim()],
    );
    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = req.body as { isCancelled?: boolean };
    if (typeof body.isCancelled !== 'boolean') {
      return res.status(400).json({ error: 'isCancelled must be a boolean' });
    }
    const [slot] = await query<TimetableSlotRow>(
      'UPDATE timetable_slots SET is_cancelled = $2 WHERE id = $1 RETURNING *',
      [req.params.id, body.isCancelled],
    );
    if (!slot) return res.status(404).json({ error: 'slot not found' });
    res.json(slot);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [slot] = await query<TimetableSlotRow>(
      'DELETE FROM timetable_slots WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (!slot) return res.status(404).json({ error: 'slot not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
