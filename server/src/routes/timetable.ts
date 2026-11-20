import { Router, json } from 'express';
import { pool, query } from '../db.js';
import type { CourseRow, TimetableSlotDetailRow, TimetableSlotRow, TimetableSwapRow } from '../types.js';
import { SLOTS, DATE_PATTERN, TIME_PATTERN, findSlotByStart, normalizeTime } from '../slots.js';
import { dayOfWeekOf, mondayOf, parseDate, todayLocal, dateOnly } from '../dates.js';

const router = Router();
router.use(json());

interface SwapDetailRow {
  id: string;
  week_start: string;
  slot_a: string;
  slot_b: string;
  created_at: string;
  a_day: number;
  a_start: string;
  a_end: string;
  b_day: number;
  b_start: string;
  b_end: string;
  a_course_id: string;
  b_course_id: string;
  a_code: string;
  a_name: string;
  b_code: string;
  b_name: string;
}

interface SlotWithCourse {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string | null;
  isCancelled: boolean;
  course: { id: string; code: string; name: string };
}

function toSlotDto(row: TimetableSlotDetailRow): SlotWithCourse {
  return {
    id: row.id,
    courseId: row.course_id,
    dayOfWeek: row.day_of_week,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    venue: row.venue,
    isCancelled: row.is_cancelled,
    course: { id: row.course_id, code: row.course_code, name: row.course_name },
  };
}

function swapDto(row: SwapDetailRow) {
  return {
    id: row.id,
    weekStart: dateOnly(row.week_start),
    slotAId: row.slot_a,
    slotBId: row.slot_b,
    createdAt: row.created_at,
    a: { slotId: row.slot_a, courseId: row.a_course_id, dayOfWeek: row.a_day, startTime: normalizeTime(row.a_start), code: row.a_code, name: row.a_name },
    b: { slotId: row.slot_b, courseId: row.b_course_id, dayOfWeek: row.b_day, startTime: normalizeTime(row.b_start), code: row.b_code, name: row.b_name },
  };
}

function parseWeekStart(value: unknown): string | { error: string } {
  if (value === undefined || value === null || value === '') return mondayOf(new Date());
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return { error: 'week must be in YYYY-MM-DD format' };
  }
  return mondayOf(parseDate(value));
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query<TimetableSlotDetailRow>(
      `SELECT t.*, c.code AS course_code, c.name AS course_name
       FROM timetable_slots t
       JOIN courses c ON c.id = t.course_id
       ORDER BY t.day_of_week ASC, t.start_time ASC`,
    );
    res.json(rows.map(toSlotDto));
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
      venue?: string | null;
    };
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek ?? 0) < 1 || (dayOfWeek ?? 0) > 5) {
      return res.status(400).json({ error: 'dayOfWeek must be an integer 1-5 (Mon-Fri)' });
    }
    if (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime)) {
      return res.status(400).json({ error: 'startTime must be in HH:MM format' });
    }
    const slotDef = findSlotByStart(startTime);
    if (!slotDef) return res.status(400).json({ error: `startTime must be one of the fixed slots: ${SLOTS.map((s) => s.startTime).join(', ')}` });
    if (endTime !== undefined && normalizeTime(endTime) !== slotDef.endTime) {
      return res.status(400).json({ error: `endTime must be ${slotDef.endTime} for the ${slotDef.startTime} slot` });
    }
    if (venue != null && (typeof venue !== 'string' || venue.length > 50)) {
      return res.status(400).json({ error: 'venue must be a string of at most 50 characters' });
    }

    const [course] = await query<CourseRow>('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (!course) return res.status(404).json({ error: 'course not found' });

    const [occupied] = await query<{ id: string }>(
      'SELECT id FROM timetable_slots WHERE day_of_week = $1 AND start_time = $2',
      [dayOfWeek, slotDef.startTime],
    );
    if (occupied) return res.status(409).json({ error: 'that slot is already occupied' });

    const [row] = await query<TimetableSlotDetailRow>(
      `INSERT INTO timetable_slots (course_id, day_of_week, start_time, end_time, venue)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *,
         (SELECT code FROM courses WHERE id = $1) AS course_code,
         (SELECT name FROM courses WHERE id = $1) AS course_name`,
      [courseId, dayOfWeek, slotDef.startTime, slotDef.endTime, venue?.trim() || null],
    );
    res.status(201).json(toSlotDto(row));
  } catch (err) {
    next(err);
  }
});

router.put('/slots/:id', async (req, res, next) => {
  try {
    const body = req.body as {
      dayOfWeek?: number;
      startTime?: string;
      venue?: string | null;
      isCancelled?: boolean;
    };
    const hasMove = body.dayOfWeek !== undefined || body.startTime !== undefined;
    const hasVenue = 'venue' in body;
    const hasCancel = body.isCancelled !== undefined;
    if (!hasMove && !hasVenue && !hasCancel) {
      return res.status(400).json({ error: 'provide dayOfWeek/startTime, venue and/or isCancelled' });
    }

    const [slot] = await query<TimetableSlotRow>('SELECT * FROM timetable_slots WHERE id = $1', [req.params.id]);
    if (!slot) return res.status(404).json({ error: 'slot not found' });

    let day = slot.day_of_week;
    let start = normalizeTime(slot.start_time);

    if (body.dayOfWeek !== undefined) {
      if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 1 || body.dayOfWeek > 5) {
        return res.status(400).json({ error: 'dayOfWeek must be an integer 1-5 (Mon-Fri)' });
      }
      day = body.dayOfWeek;
    }
    if (body.startTime !== undefined) {
      if (typeof body.startTime !== 'string' || !TIME_PATTERN.test(body.startTime)) {
        return res.status(400).json({ error: 'startTime must be in HH:MM format' });
      }
      const slotDef = findSlotByStart(body.startTime);
      if (!slotDef) {
        return res.status(400).json({ error: `startTime must be one of the fixed slots: ${SLOTS.map((s) => s.startTime).join(', ')}` });
      }
      start = slotDef.startTime;
    }
    if (hasVenue) {
      const v = body.venue;
      if (v != null && (typeof v !== 'string' || v.length > 50)) {
        return res.status(400).json({ error: 'venue must be a string of at most 50 characters' });
      }
    }
    if (hasCancel && typeof body.isCancelled !== 'boolean') {
      return res.status(400).json({ error: 'isCancelled must be a boolean' });
    }

    if (day !== slot.day_of_week || start !== normalizeTime(slot.start_time)) {
      const [occupied] = await query<{ id: string }>(
        'SELECT id FROM timetable_slots WHERE day_of_week = $1 AND start_time = $2 AND id <> $3',
        [day, start, slot.id],
      );
      if (occupied) return res.status(409).json({ error: 'that slot is already occupied' });
    }

    const [row] = await query<TimetableSlotDetailRow>(
      `UPDATE timetable_slots SET
         day_of_week = $2,
         start_time = $3,
         end_time = $4,
         venue = $5,
         is_cancelled = $6
       WHERE id = $1
       RETURNING *,
         (SELECT code FROM courses WHERE id = course_id) AS course_code,
         (SELECT name FROM courses WHERE id = course_id) AS course_name`,
      [slot.id, day, start, findSlotByStart(start)!.endTime,
        hasVenue ? (body.venue?.trim() || null) : slot.venue,
        hasCancel ? body.isCancelled : slot.is_cancelled],
    );
    res.json(toSlotDto(row));
  } catch (err) {
    next(err);
  }
});

router.delete('/slots/:id', async (req, res, next) => {
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

// Swap = exchange the modules of two slots for one week. Posting the same pair
// again reverts it; either slot already being in another swap reverts that one first.
router.post('/swaps', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { weekStart, slotAId, slotBId } = req.body as {
      weekStart?: string;
      slotAId?: string;
      slotBId?: string;
    };
    if (!slotAId || !slotBId) return res.status(400).json({ error: 'slotAId and slotBId are required' });
    if (slotAId === slotBId) return res.status(400).json({ error: 'cannot swap a slot with itself' });
    const week = parseWeekStart(weekStart);
    if (typeof week === 'object') return res.status(400).json({ error: week.error });

    const [slotA] = await query<TimetableSlotRow>('SELECT * FROM timetable_slots WHERE id = $1', [slotAId]);
    const [slotB] = await query<TimetableSlotRow>('SELECT * FROM timetable_slots WHERE id = $1', [slotBId]);
    if (!slotA || !slotB) return res.status(404).json({ error: 'slot not found' });

    const ordered = [slotAId, slotBId].sort();
    const [a, b] = ordered;

    await client.query('BEGIN');

    const existing = await client.query<TimetableSwapRow>(
      `SELECT * FROM timetable_swaps
       WHERE week_start = $1
         AND ((slot_a = $2 AND slot_b = $3) OR (slot_a = $3 AND slot_b = $2))`,
      [week, a, b],
    );

    if (existing.rows.length > 0) {
      await client.query('DELETE FROM timetable_swaps WHERE id = $1', [existing.rows[0].id]);
      await client.query('COMMIT');
      return res.json({ action: 'reverted', swap: null });
    }

    // Revert any other swaps touching either slot so each slot is in at most one swap.
    await client.query(
      `DELETE FROM timetable_swaps
       WHERE week_start = $1 AND (slot_a IN ($2, $3) OR slot_b IN ($2, $3))`,
      [week, a, b],
    );

    const created = await client.query<TimetableSwapRow>(
      `INSERT INTO timetable_swaps (week_start, slot_a, slot_b)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [week, a, b],
    );
    await client.query('COMMIT');
    res.status(201).json({ action: 'created', swapId: created.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

router.get('/swaps', async (req, res, next) => {
  try {
    const week = parseWeekStart(req.query.week);
    if (typeof week === 'object') return res.status(400).json({ error: week.error });

    const rows = await query<SwapDetailRow>(
      `SELECT s.id, s.week_start, s.slot_a, s.slot_b, s.created_at,
              pa.day_of_week AS a_day, pa.start_time AS a_start, pa.end_time AS a_end,
              pb.day_of_week AS b_day, pb.start_time AS b_start, pb.end_time AS b_end,
              ca.code AS a_code, ca.name AS a_name,
              cb.code AS b_code, cb.name AS b_name
       FROM timetable_swaps s
       JOIN timetable_slots pa ON pa.id = s.slot_a
       JOIN timetable_slots pb ON pb.id = s.slot_b
       JOIN courses ca ON ca.id = pa.course_id
       JOIN courses cb ON cb.id = pb.course_id
       WHERE s.week_start = $1
       ORDER BY s.created_at ASC`,
      [week],
    );
    res.json(rows.map(swapDto));
  } catch (err) {
    next(err);
  }
});

router.delete('/swaps/:id', async (req, res, next) => {
  try {
    const [swap] = await query<TimetableSwapRow>(
      'DELETE FROM timetable_swaps WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (!swap) return res.status(404).json({ error: 'swap not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Effective schedule for one date: base grid with the week's swaps applied,
// plus each slot's attendance log status for that date.
router.get('/today', async (req, res, next) => {
  try {
    const dateParam = typeof req.query.date === 'string' && DATE_PATTERN.test(req.query.date)
      ? req.query.date
      : todayLocal();
    const date = parseDate(dateParam);
    const dow = dayOfWeekOf(date);
    if (dow > 5) {
      res.json([]);
      return;
    }
    const week = mondayOf(date);

    const [slotRows, swapRows, logRows] = await Promise.all([
      query<TimetableSlotDetailRow>(
        `SELECT t.*, c.code AS course_code, c.name AS course_name
         FROM timetable_slots t
         JOIN courses c ON c.id = t.course_id
         WHERE t.day_of_week = $1
         ORDER BY t.start_time ASC`,
        [dow],
      ),
      query<SwapDetailRow>(
        `SELECT s.id, s.week_start, s.slot_a, s.slot_b, s.created_at,
                pa.day_of_week AS a_day, pa.start_time AS a_start, pa.end_time AS a_end,
                pb.day_of_week AS b_day, pb.start_time AS b_start, pb.end_time AS b_end,
                pa.course_id AS a_course_id, pb.course_id AS b_course_id,
                ca.code AS a_code, ca.name AS a_name,
                cb.code AS b_code, cb.name AS b_name
         FROM timetable_swaps s
         JOIN timetable_slots pa ON pa.id = s.slot_a
         JOIN timetable_slots pb ON pb.id = s.slot_b
         JOIN courses ca ON ca.id = pa.course_id
         JOIN courses cb ON cb.id = pb.course_id
         WHERE s.week_start = $1`,
        [week],
      ),
      query<{ course_id: string; slot_time: string; status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED' | 'GHOST' }>(
        `SELECT course_id, slot_time::text AS slot_time, status
         FROM attendance_logs
         WHERE log_date = $1 AND slot_time IS NOT NULL`,
        [dateParam],
      ),
    ]);

    // slotId -> the other side of its swap (that slot's module takes over this period)
    const partner = new Map<string, {
      courseId: string;
      code: string;
      name: string;
      dayOfWeek: number;
      startTime: string;
    }>();
    for (const s of swapRows) {
      partner.set(s.slot_a, {
        courseId: s.b_course_id, code: s.b_code, name: s.b_name,
        dayOfWeek: s.b_day, startTime: normalizeTime(s.b_start),
      });
      partner.set(s.slot_b, {
        courseId: s.a_course_id, code: s.a_code, name: s.a_name,
        dayOfWeek: s.a_day, startTime: normalizeTime(s.a_start),
      });
    }

    const logStatus = new Map<string, 'ATTENDED' | 'SKIPPED' | 'CANCELLED' | 'GHOST'>();
    for (const l of logRows) {
      logStatus.set(`${l.course_id}|${normalizeTime(l.slot_time)}`, l.status);
    }

    const payload = slotRows.map((row) => {
      const swapped = partner.get(row.id) ?? null;
      const effectiveCourse = swapped
        ? { id: swapped.courseId, code: swapped.code, name: swapped.name }
        : { id: row.course_id, code: row.course_code, name: row.course_name };
      return {
        id: row.id,
        dayOfWeek: row.day_of_week,
        startTime: normalizeTime(row.start_time),
        endTime: normalizeTime(row.end_time),
        venue: row.venue,
        isCancelled: row.is_cancelled,
        course: effectiveCourse,
        swappedWith: swapped
          ? { dayOfWeek: swapped.dayOfWeek, startTime: swapped.startTime, code: swapped.code }
          : null,
        logStatus: logStatus.get(`${effectiveCourse.id}|${normalizeTime(row.start_time)}`) ?? null,
      };
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
