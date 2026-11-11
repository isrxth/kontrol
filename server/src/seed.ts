import 'dotenv/config';
import { pool } from './db.js';

const COURSES = [
  { code: 'ITM 2101', name: 'Database Systems', totalLectures: 30, requiredRatio: 0.8, credits: 3 },
  { code: 'ITM 2102', name: 'Software Architecture', totalLectures: 24, requiredRatio: 0.8, credits: 3 },
  { code: 'ITM 2103', name: 'Data Structures', totalLectures: 36, requiredRatio: 0.8, credits: 3 },
];

async function seed() {
  try {
    for (const [index, c] of COURSES.entries()) {
      const { rows } = await pool.query(
        `INSERT INTO courses (code, name, credits, total_lectures, required_ratio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [c.code, c.name, c.credits, c.totalLectures, c.requiredRatio],
      );
      const courseId = rows[0].id;

      const existing = await pool.query(
        'SELECT 1 FROM timetable_slots WHERE course_id = $1 LIMIT 1',
        [courseId],
      );

      if (existing.rowCount === 0) {
        const dayA = (index * 2) % 7 + 1;
        const dayB = (index * 2 + 1) % 7 + 1;
        await pool.query(
          `INSERT INTO timetable_slots (course_id, day_of_week, start_time, end_time, venue)
           VALUES ($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9)`,
          [courseId, dayA, '09:00', '10:30', 'Lab 0' + (index + 1), dayB, '08:00', '09:30', 'Room 1' + (index + 1)],
        );
      }
      console.log(`seeded ${c.code} (${courseId})`);
    }

    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
