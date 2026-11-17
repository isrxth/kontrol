import 'dotenv/config';
import { Pool } from 'pg';

const rawUrl = process.env.DATABASE_URL || '';

// Strip sslmode from the URI so node-postgres does not override rejectUnauthorized: false
const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*(&|$)/, (_match, p1, p2) =>
  p1 === '?' && p2 ? '?' : p2 ? p1 : ''
);

const useSsl =
  rawUrl.includes('supabase') ||
  rawUrl.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL);

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 1, // 1 connection per serverless Lambda (prevents 15-client saturation)
  idleTimeoutMillis: 100, // Release socket to Supabase 100ms after query finishes
  allowExitOnIdle: true,
  connectionTimeoutMillis: 10000,
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result.rows as T[];
    } catch (err: any) {
      const isPoolFull =
        err?.code === 'EMAXCONNSESSION' ||
        (typeof err?.message === 'string' && err.message.includes('max clients reached'));

      if (isPoolFull && attempt < maxRetries) {
        // Wait 150ms -> 300ms -> 450ms for another Lambda's 100ms idle socket to close
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        continue;
      }

      throw err;
    }
  }

  return [];
}