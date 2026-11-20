import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import type { Request, Response, NextFunction } from 'express';

authenticator.options = { window: 1 };

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'kontrol-dev-secret-do-not-use-in-production';
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
if (IS_PROD && process.env.AUTH_JWT_SECRET === undefined) {
  // eslint-disable-next-line no-console
  console.warn('[auth] AUTH_JWT_SECRET is not set; session cookies will not be securely signed.');
}

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_COOKIE = 'kontrol_session';

export function signSession(payload: Record<string, unknown>, expiresIn: string | number = '30d'): string {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, { expiresIn: expiresIn as any }) as string;
}

export function verifySession(token: string): { sub: string; iat?: number; exp?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; iat?: number; exp?: number };
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return (req.cookies?.[SESSION_COOKIE] ?? null);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  (req as any).auth = payload;
  next();
}

/** Hash a 6-digit PIN with scrypt + a random 16-byte salt. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

/** Constant-time PIN verification against a `scrypt$...$salt$hash` string. */
export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4], 'hex');
  const expectedHash = Buffer.from(parts[5], 'hex');
  const computedHash = scryptSync(pin, salt, 64);
  if (computedHash.length !== expectedHash.length) return false;
  return timingSafeEqual(computedHash, expectedHash);
}

/** Verify a 6-digit Google Authenticator TOTP code against a base32 secret. */
export function verifyTotp(code: string, secret: string): boolean {
  return authenticator.check(code, secret);
}

export function makeOtpAuthUri(secret: string): string {
  return authenticator.keyuri('owner', 'Kontrol', secret);
}
