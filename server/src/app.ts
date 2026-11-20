import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import logsRouter from './routes/logs.js';
import timetableRouter from './routes/timetable.js';
import projectsRouter from './routes/projects.js';
import activitiesRouter from './routes/activities.js';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { query } from './db.js';

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());

app.get(['/api', '/api/health'], async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/courses', requireAuth, coursesRouter);
app.use('/api/courses', requireAuth, logsRouter);
app.use('/api/timetable', requireAuth, timetableRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/activities', requireAuth, activitiesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[server error]', err);
  res.status(500).json({
    error: message,
    code: err?.code,
  });
});

export default app;
