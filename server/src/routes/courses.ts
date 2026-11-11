import { Router, json } from 'express';
import { query } from '../db.js';
import { calculateRisk, type CourseRow, type CourseStatsRow } from '../types.js';

const router = Router();
router.use(json());

router.get('/', async (_req, res, next) => {
  try {
    const courses = await query<CourseRow>('SELECT * FROM courses ORDER BY code ASC');
    res.json(courses);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const statsRows = await query<CourseStatsRow>(`
      SELECT c.*,
             COUNT(l.*) FILTER (WHERE l.status = 'ATTENDED')::int  AS attended_count,
             COUNT(l.*) FILTER (WHERE l.status = 'SKIPPED')::int   AS skipped_count,
             COUNT(l.*) FILTER (WHERE l.status = 'CANCELLED')::int AS cancelled_count
      FROM courses c
      LEFT JOIN attendance_logs l ON l.course_id = c.id
      GROUP BY c.id
      ORDER BY c.code ASC
    `);

    const payload = statsRows.map((row) => {
      const risk = calculateRisk(
        row.total_lectures,
        row.required_ratio,
        row.skipped_count,
        row.attended_count,
      );
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        credits: row.credits,
        totalLectures: row.total_lectures,
        requiredRatio: row.required_ratio,
        attendedCount: row.attended_count,
        skippedCount: row.skipped_count,
        cancelledCount: row.cancelled_count,
        ...risk,
      };
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, name, totalLectures, requiredRatio, credits } = req.body as {
      code?: string;
      name?: string;
      totalLectures?: number;
      requiredRatio?: number;
      credits?: number;
    };
    if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: 'code and name are required' });
    if (!Number.isInteger(totalLectures) || (totalLectures ?? 0) < 1) {
      return res.status(400).json({ error: 'totalLectures must be a positive integer' });
    }
    const ratio = requiredRatio ?? 0.8;
    if (typeof ratio !== 'number' || ratio <= 0 || ratio >= 1) {
      return res.status(400).json({ error: 'requiredRatio must be between 0 and 1' });
    }

    const [course] = await query<CourseRow>(
      `INSERT INTO courses (code, name, credits, total_lectures, required_ratio)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             credits = EXCLUDED.credits,
             total_lectures = EXCLUDED.total_lectures,
             required_ratio = EXCLUDED.required_ratio
       RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), credits ?? 3, totalLectures, ratio],
    );
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'credits', 'total_lectures', 'required_ratio'] as const;
    const body = req.body as Record<string, unknown>;
    const keys = allowed.filter((k) => k in body);
    if (keys.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => body[k]);
    const [course] = await query<CourseRow>(
      `UPDATE courses SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values],
    );
    if (!course) return res.status(404).json({ error: 'course not found' });
    res.json(course);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [course] = await query<CourseRow>('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id]);
    if (!course) return res.status(404).json({ error: 'course not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
