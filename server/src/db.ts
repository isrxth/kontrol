import 'dotenv/config';
import { Client, Pool } from 'pg';

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

const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

// Keep pool export for /api/health or legacy imports, capped to 1 short-lived socket
export const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  max: 1,
  idleTimeoutMillis: 100,
  allowExitOnIdle: true,
  connectionTimeoutMillis: 15000,
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const client = new Client({
      connectionString,
      ssl: sslConfig,
      connectionTimeoutMillis: 15000,
    });

    try {
      await client.connect();
      const result = await client.query(text, params);
      return result.rows as T[];
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : '';
      const isTransient =
        err?.code === 'XX000' ||
        err?.code === 'EMAXCONNSESSION' ||
        msg.includes('EMAXCONNSESSION') ||
        msg.includes('max clients reached') ||
        msg.includes('timeout exceeded');

      if (isTransient && attempt < maxRetries) {
        // Jittered backoff (200ms - 1000ms) so parallel Promise.all calls stagger cleanly
        const delay = 200 * (attempt + 1) + Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    } finally {
      await client.end().catch(() => { });
    }
  }

  return [];
}