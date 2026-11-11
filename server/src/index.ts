import express from 'express';
import cors from 'cors';
import coursesRouter from './routes/courses.js';
import logsRouter from './routes/logs.js';
import timetableRouter from './routes/timetable.js';
import { pool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    next(err);
  }
});

app.use('/api/courses', coursesRouter);
app.use('/api/courses', logsRouter);
app.use('/api/timetable', timetableRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[server error]', message);
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Kontrol API listening on http://localhost:${PORT}`);
});
