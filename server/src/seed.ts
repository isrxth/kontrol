import 'dotenv/config';
import { pool } from './db.js';
import { SLOTS } from './slots.js';

const COURSES = [
  { code: 'ITM 2101', name: 'Database Systems', totalLectures: 30, requiredRatio: 0.8, credits: 3 },
  { code: 'ITM 2102', name: 'Software Architecture', totalLectures: 24, requiredRatio: 0.8, credits: 3 },
  { code: 'ITM 2103', name: 'Data Structures', totalLectures: 36, requiredRatio: 0.8, credits: 3 },
];

// One distinct cell per course so the seeded board is readable: Mon/S1, Tue/S2, Wed/S3.
const SEED_CELLS = [
  { day: 1, slotIndex: 1, venue: 'Room 101' },
  { day: 2, slotIndex: 2, venue: 'Lab 204' },
  { day: 3, slotIndex: 3, venue: 'Room 305' },
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
        const cell = SEED_CELLS[index] ?? { day: (index % 5) + 1, slotIndex: 1, venue: null };
        const slotDef = SLOTS[cell.slotIndex - 1] ?? SLOTS[0];
        await pool.query(
          `INSERT INTO timetable_slots (course_id, day_of_week, start_time, end_time, venue)
           VALUES ($1, $2, $3, $4, $5)`,
          [courseId, cell.day, slotDef.startTime, slotDef.endTime, cell.venue],
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
