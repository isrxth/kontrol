import { Router, json } from 'express';
import type { Response } from 'express';
import { pool, query } from '../db.js';
import type {
  ProjectDetailRow,
  ProjectKind,
  ProjectStatus,
  ProjectTaskRow,
} from '../types.js';

const router = Router();
router.use(json());

const STATUSES: ProjectStatus[] = ['IDEA', 'BUILDING', 'SHIPPED', 'PAUSED'];
const KINDS: ProjectKind[] = ['PERSONAL', 'COURSEWORK'];

function toProjectDto(row: ProjectDetailRow) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    courseId: row.course_id,
    courseCode: row.course_code,
    status: row.status,
    description: row.description,
    repoUrl: row.repo_url,
    liveUrl: row.live_url,
    techStack: row.tech_stack ?? [],
    position: row.position,
    doneTaskCount: Number(row.done_task_count ?? 0),
    totalTaskCount: Number(row.total_task_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTaskDto(row: ProjectTaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    isDone: row.is_done,
    position: row.position,
    createdAt: row.created_at,
  };
}

const PROJECT_SELECT = `
  SELECT p.*,
         c.code AS course_code,
         (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.is_done = TRUE)::int AS done_task_count,
         (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id)::int AS total_task_count
  FROM projects p
  LEFT JOIN courses c ON c.id = p.course_id
`;

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query<ProjectDetailRow>(
      `${PROJECT_SELECT} ORDER BY p.status ASC, p.position ASC, p.created_at ASC`,
    );
    res.json(rows.map(toProjectDto));
  } catch (err) {
    next(err);
  }
});

interface ProjectInput {
  title?: string;
  kind?: string;
  courseId?: string | null;
  status?: string;
  description?: string | null;
  repoUrl?: string | null;
  liveUrl?: string | null;
  techStack?: string[] | null;
}

function validateProjectInput(body: ProjectInput, res: Response): ProjectInput | null {
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120)) {
    res.status(400).json({ error: 'title is required (max 120 chars)' });
    return null;
  }
  if (body.kind !== undefined && !KINDS.includes(body.kind as ProjectKind)) {
    res.status(400).json({ error: `kind must be one of ${KINDS.join(', ')}` });
    return null;
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as ProjectStatus)) {
    res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    return null;
  }
  const links = ['courseId', 'repoUrl', 'liveUrl'] as const;
  for (const key of links) {
    const value = body[key];
    if (value != null && typeof value !== 'string') {
      res.status(400).json({ error: `${key} must be a string or null` });
      return null;
    }
  }
  if (body.repoUrl && !/^https?:\/\//.test(body.repoUrl)) {
    res.status(400).json({ error: 'repoUrl must start with http:// or https://' });
    return null;
  }
  if (body.liveUrl && !/^https?:\/\//.test(body.liveUrl)) {
    res.status(400).json({ error: 'liveUrl must start with http:// or https://' });
    return null;
  }
  if (body.techStack !== undefined && body.techStack !== null) {
    if (!Array.isArray(body.techStack) || body.techStack.some((t) => typeof t !== 'string' || t.length > 30)) {
      res.status(400).json({ error: 'techStack must be an array of short strings' });
      return null;
    }
  }
  return body;
}

router.post('/', async (req, res, next) => {
  try {
    const body = validateProjectInput(req.body as ProjectInput, res);
    if (!body) return;
    if (!body.title?.trim()) return res.status(400).json({ error: 'title is required (max 120 chars)' });

    const kind = (body.kind ?? 'PERSONAL') as ProjectKind;
    const courseId = kind === 'COURSEWORK' ? body.courseId || null : null;

    if (courseId) {
      const [course] = await query<{ id: string }>('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (!course) return res.status(404).json({ error: 'course not found' });
    }

    const [inserted] = await query<{ id: string }>(
      `INSERT INTO projects (title, kind, course_id, status, description, repo_url, live_url, tech_stack, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         (SELECT COALESCE(MAX(position), 0) + 1 FROM projects WHERE status = $9))
       RETURNING id`,
      [
        body.title.trim(), kind, courseId, (body.status ?? 'IDEA') as ProjectStatus,
        body.description?.trim() || null, body.repoUrl?.trim() || null,
        body.liveUrl?.trim() || null, body.techStack ?? null,
        (body.status ?? 'IDEA') as ProjectStatus,
      ],
    );
    const [row] = await query<ProjectDetailRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [inserted.id]);
    res.status(201).json(toProjectDto(row));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = validateProjectInput(req.body as ProjectInput, res);
    if (!body) return;

    const [existing] = await query<ProjectDetailRow>('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'project not found' });

    const kind = (body.kind ?? existing.kind) as ProjectKind;
    let courseId = 'courseId' in body ? body.courseId || null : existing.course_id;
    if (kind === 'PERSONAL') courseId = null;
    if (courseId && courseId !== existing.course_id) {
      const [course] = await query<{ id: string }>('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (!course) return res.status(404).json({ error: 'course not found' });
    }

    const [updated] = await query<{ id: string }>(
      `UPDATE projects SET
         title = $2,
         kind = $3,
         course_id = $4,
         status = $5,
         description = $6,
         repo_url = $7,
         live_url = $8,
         tech_stack = $9,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [
        req.params.id,
        body.title?.trim() ?? existing.title,
        kind,
        courseId,
        (body.status ?? existing.status) as ProjectStatus,
        'description' in body ? body.description?.trim() || null : existing.description,
        'repoUrl' in body ? body.repoUrl?.trim() || null : existing.repo_url,
        'liveUrl' in body ? body.liveUrl?.trim() || null : existing.live_url,
        body.techStack ?? existing.tech_stack,
      ],
    );
    const [row] = await query<ProjectDetailRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [updated.id]);
    res.json(toProjectDto(row));
  } catch (err) {
    next(err);
  }
});

// Renumber one column after a drag. { status, orderedIds: [projectId...] }
router.post('/reorder', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { status, orderedIds } = req.body as { status?: string; orderedIds?: string[] };
    if (!status || !STATUSES.includes(status as ProjectStatus)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'orderedIds must be an array of project ids' });
    }

    await client.query('BEGIN');
    for (const [index, id] of orderedIds.entries()) {
      await client.query(
        'UPDATE projects SET status = $1, position = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [status, (index + 1) * 100, id],
      );
    }
    await client.query('COMMIT');
    res.json({ reordered: orderedIds.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [row] = await query<{ id: string }>('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'project not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Tasks ---

router.get('/:id/tasks', async (req, res, next) => {
  try {
    const tasks = await query<ProjectTaskRow>(
      'SELECT * FROM project_tasks WHERE project_id = $1 ORDER BY position ASC, created_at ASC',
      [req.params.id],
    );
    res.json(tasks.map(toTaskDto));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/tasks', async (req, res, next) => {
  try {
    const { title } = req.body as { title?: string };
    if (!title?.trim() || title.length > 200) {
      return res.status(400).json({ error: 'title is required (max 200 chars)' });
    }
    const [project] = await query<{ id: string }>('SELECT id FROM projects WHERE id = $1', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'project not found' });

    const [row] = await query<ProjectTaskRow>(
      `INSERT INTO project_tasks (project_id, title, position)
       VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM project_tasks WHERE project_id = $1))
       RETURNING *`,
      [req.params.id, title.trim()],
    );
    res.status(201).json(toTaskDto(row));
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:taskId', async (req, res, next) => {
  try {
    const body = req.body as { title?: string; isDone?: boolean };
    if (body.title === undefined && body.isDone === undefined) {
      return res.status(400).json({ error: 'provide title and/or isDone' });
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)) {
      return res.status(400).json({ error: 'title must be 1-200 chars' });
    }
    if (body.isDone !== undefined && typeof body.isDone !== 'boolean') {
      return res.status(400).json({ error: 'isDone must be a boolean' });
    }
    const [task] = await query<ProjectTaskRow>('SELECT * FROM project_tasks WHERE id = $1', [req.params.taskId]);
    if (!task) return res.status(404).json({ error: 'task not found' });

    const [row] = await query<ProjectTaskRow>(
      `UPDATE project_tasks SET
         title = $2,
         is_done = $3
       WHERE id = $1
       RETURNING *`,
      [req.params.taskId, body.title?.trim() ?? task.title, body.isDone ?? task.is_done],
    );
    res.json(toTaskDto(row));
  } catch (err) {
    next(err);
  }
});

router.delete('/tasks/:taskId', async (req, res, next) => {
  try {
    const [row] = await query<ProjectTaskRow>('DELETE FROM project_tasks WHERE id = $1 RETURNING id', [req.params.taskId]);
    if (!row) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
