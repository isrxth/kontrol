import { Router, json } from 'express';
import type { Response } from 'express';
import { query } from '../db.js';
import type { ActivityDetailRow, ActivityPriority, ActivityType } from '../types.js';
import { DATE_PATTERN, TIME_PATTERN, normalizeTime } from '../slots.js';
import { isValidDateOnly } from '../dates.js';
import { dateOnly } from '../dates.js';

const router = Router();
router.use(json());

const TYPES: ActivityType[] = ['EXAM', 'COURSEWORK', 'EVENT', 'OTHER'];
const PRIORITIES: ActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

const ACTIVITY_SELECT = `
  SELECT a.*, c.code AS course_code
  FROM activities a
  LEFT JOIN courses c ON c.id = a.course_id
`;

function toActivityDto(row: ActivityDetailRow) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    courseId: row.course_id,
    courseCode: row.course_code,
    dueDate: row.due_date ? dateOnly(row.due_date) : null,
    dueTime: row.due_time ? normalizeTime(row.due_time) : null,
    priority: row.priority,
    notes: row.notes,
    isDone: row.is_done,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ActivityInput {
  title?: string;
  type?: string;
  courseId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: string;
  notes?: string | null;
  isDone?: boolean;
}

function validateActivityInput(body: ActivityInput, res: Response): ActivityInput | null {
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)) {
    res.status(400).json({ error: 'title is required (max 200 chars)' });
    return null;
  }
  if (body.type !== undefined && !TYPES.includes(body.type as ActivityType)) {
    res.status(400).json({ error: `type must be one of ${TYPES.join(', ')}` });
    return null;
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority as ActivityPriority)) {
    res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(', ')}` });
    return null;
  }
  if (body.dueDate != null && !(typeof body.dueDate === 'string' && DATE_PATTERN.test(body.dueDate) && isValidDateOnly(body.dueDate))) {
    res.status(400).json({ error: 'dueDate must be YYYY-MM-DD or null' });
    return null;
  }
  if (body.dueTime != null && !(typeof body.dueTime === 'string' && TIME_PATTERN.test(body.dueTime))) {
    res.status(400).json({ error: 'dueTime must be HH:MM or null' });
    return null;
  }
  for (const key of ['courseId', 'notes'] as const) {
    if (body[key] != null && typeof body[key] !== 'string') {
      res.status(400).json({ error: `${key} must be a string or null` });
      return null;
    }
  }
  if (body.isDone !== undefined && typeof body.isDone !== 'boolean') {
    res.status(400).json({ error: 'isDone must be a boolean' });
    return null;
  }
  return body;
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query<ActivityDetailRow>(
      `${ACTIVITY_SELECT}
       ORDER BY a.is_done ASC,
                a.due_date ASC NULLS LAST,
                a.due_time ASC NULLS LAST,
                a.created_at ASC`,
    );
    res.json(rows.map(toActivityDto));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = validateActivityInput(req.body as ActivityInput, res);
    if (!body) return;
    if (!body.title?.trim()) return res.status(400).json({ error: 'title is required (max 200 chars)' });

    if (body.courseId) {
      const [course] = await query<{ id: string }>('SELECT id FROM courses WHERE id = $1', [body.courseId]);
      if (!course) return res.status(404).json({ error: 'course not found' });
    }

    const isDone = body.isDone === true;
    const [row] = await query<ActivityDetailRow>(
      `INSERT INTO activities (title, type, course_id, due_date, due_time, priority, notes, is_done, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        body.title.trim(),
        (body.type ?? 'OTHER') as ActivityType,
        body.courseId || null,
        body.dueDate || null,
        body.dueTime || null,
        (body.priority ?? 'MEDIUM') as ActivityPriority,
        body.notes?.trim() || null,
        isDone,
        isDone ? new Date().toISOString() : null,
      ],
    );
    const [created] = await query<ActivityDetailRow>(`${ACTIVITY_SELECT} WHERE a.id = $1`, [row.id]);
    res.status(201).json(toActivityDto(created));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = validateActivityInput(req.body as ActivityInput, res);
    if (!body) return;

    const [existing] = await query<ActivityDetailRow>('SELECT * FROM activities WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'activity not found' });

    if (body.courseId != null && body.courseId !== existing.course_id) {
      const [course] = await query<{ id: string }>('SELECT id FROM courses WHERE id = $1', [body.courseId]);
      if (!course) return res.status(404).json({ error: 'course not found' });
    }

    const isDone = body.isDone ?? existing.is_done;
    const completedAt = body.isDone === undefined ? existing.completed_at : (body.isDone ? new Date().toISOString() : null);

    await query(
      `UPDATE activities SET
         title = $2,
         type = $3,
         course_id = $4,
         due_date = $5,
         due_time = $6,
         priority = $7,
         notes = $8,
         is_done = $9,
         completed_at = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        req.params.id,
        body.title?.trim() ?? existing.title,
        (body.type ?? existing.type) as ActivityType,
        'courseId' in body ? body.courseId || null : existing.course_id,
        'dueDate' in body ? body.dueDate || null : existing.due_date,
        'dueTime' in body ? body.dueTime || null : (existing.due_time ? normalizeTime(existing.due_time) : null),
        (body.priority ?? existing.priority) as ActivityPriority,
        'notes' in body ? body.notes?.trim() || null : existing.notes,
        isDone,
        completedAt,
      ],
    );
    const [row] = await query<ActivityDetailRow>(`${ACTIVITY_SELECT} WHERE a.id = $1`, [req.params.id]);
    res.json(toActivityDto(row));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [row] = await query<{ id: string }>('DELETE FROM activities WHERE id = $1 RETURNING id', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'activity not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
