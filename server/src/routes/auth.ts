import { Router, json } from 'express';
import { query } from '../db.js';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import {
  signSession,
  verifySession,
  extractToken,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  hashPin,
  verifyPin,
  verifyTotp,
  makeOtpAuthUri,
} from '../auth.js';
import { todayLocal } from '../dates.js';

const router = Router();
router.use(json());

const SETUP_TTL_MS = 10 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

function appAuthInitializedRow() {
  return query<{ id: number; totp_secret: string | null; pin_hash: string | null; pin_attempts: number | null; pin_locked_until: string | null }>(
    'SELECT id, totp_secret, pin_hash, pin_attempts, pin_locked_until FROM app_auth WHERE id = 1',
  );
}

/* Public: is the app initialized and/or currently authenticated? */
router.get('/status', async (req, res, next) => {
  try {
    const rows = await appAuthInitializedRow();
    const row = rows[0];
    const initialized = Boolean(row?.totp_secret && row?.pin_hash);
    const token = extractToken(req);
    let authenticated = false;
    if (token) {
      authenticated = Boolean(verifySession(token));
    }
    res.json({ initialized, authenticated });
  } catch (err) {
    next(err);
  }
});

/* Public: initialize TOTP + PIN (only when app_auth is empty). Two-phase:
   1) POST with no body -> returns a short-lived setupToken + QR data.
   2) POST with { setupToken, code, pin } -> verifies, stores, issues session. */
router.post('/setup', async (req, res, next) => {
  try {
    const { setupToken, code, pin } = req.body as {
      setupToken?: string;
      code?: string;
      pin?: string;
    };

    // Finalize setup.
    if (setupToken && code && pin) {
    const payload = verifySession(setupToken);
    if (!payload || (payload as { kind?: string }).kind !== 'setup') {
      return res.status(400).json({ error: 'invalid or expired setup token' });
    }
      const secret = (payload as { secret?: string }).secret;
      if (!secret || !verifyTotp(code, secret)) {
        return res.status(401).json({ error: 'invalid verification code' });
      }
      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ error: 'PIN must be 6 digits' });
      }

      const [inserted] = await query<{ id: number }>(
        `INSERT INTO app_auth (id, totp_secret, pin_hash, totp_enabled)
         VALUES (1, $1, $2, TRUE)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [secret, hashPin(pin)],
      );
      if (!inserted) {
        return res.status(409).json({ error: 'app already initialized' });
      }

      const token = signSession({ sub: 'owner' });
      setSessionCookie(res, token);
      return res.json({ token });
    }

    // Init setup: only allowed when not initialized.
    const rows = await appAuthInitializedRow();
    if (rows[0]?.totp_secret && rows[0]?.pin_hash) {
      return res.status(409).json({ error: 'app already initialized' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = makeOtpAuthUri(secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    const token = signSession({ kind: 'setup', secret }, '10m');
    return res.json({ setupToken: token, secret, otpauth, qrDataUrl });
  } catch (err) {
    next(err);
  }
});

/* Public: verify TOTP code -> session. */
router.post('/verify-totp', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const rows = await appAuthInitializedRow();
    const row = rows[0];
    if (!row?.totp_secret) {
      return res.status(404).json({ error: 'auth not initialized' });
    }
    if (!code || !verifyTotp(code, row.totp_secret)) {
      return res.status(401).json({ error: 'invalid verification code' });
    }
    const token = signSession({ sub: 'owner' });
    setSessionCookie(res, token);
    return res.json({ token });
  } catch (err) {
    next(err);
  }
});

/* Public: verify backup PIN -> session, with rate limiting. */
router.post('/verify-pin', async (req, res, next) => {
  try {
    const { pin } = req.body as { pin?: string };
    const rows = await appAuthInitializedRow();
    const row = rows[0];
    if (!row?.pin_hash) {
      return res.status(404).json({ error: 'auth not initialized' });
    }

    const lockedUntil = row.pin_locked_until ? new Date(row.pin_locked_until) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      return res.status(429).json({
        error: 'too many failed PIN attempts',
        retryAfter: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
      });
    }

    if (!pin || !verifyPin(pin, row.pin_hash)) {
      const attempts = (row.pin_attempts ?? 0) + 1;
      let lockUntil: Date | null = null;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        lockUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
      }
      await query(
        `UPDATE app_auth
         SET pin_attempts = $1,
             pin_locked_until = $2
         WHERE id = 1`,
        [attempts, lockUntil],
      );
      if (lockUntil) {
        return res.status(429).json({
          error: 'too many failed PIN attempts',
          retryAfter: PIN_LOCK_MINUTES * 60,
        });
      }
      return res.status(401).json({ error: 'invalid PIN' });
    }

    await query(`UPDATE app_auth SET pin_attempts = 0, pin_locked_until = NULL WHERE id = 1`);
    const token = signSession({ sub: 'owner' });
    setSessionCookie(res, token);
    return res.json({ token });
  } catch (err) {
    next(err);
  }
});

/* Public: clear session. */
router.post('/logout', async (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* Authenticated: reset TOTP (two-phase, same as setup init). */
router.post('/reset-totp/init', requireAuth, async (_req, res, next) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = makeOtpAuthUri(secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    const token = signSession({ kind: 'reset-totp', secret }, '10m');
    return res.json({ setupToken: token, secret, otpauth, qrDataUrl });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-totp', requireAuth, async (req, res, next) => {
  try {
    const { setupToken, code } = req.body as { setupToken?: string; code?: string };
    if (!setupToken) {
      return res.status(400).json({ error: 'missing reset token' });
    }
    const payload = verifySession(setupToken);
    if (!payload || (payload as { kind?: string }).kind !== 'reset-totp') {
      return res.status(400).json({ error: 'invalid or expired reset token' });
    }
    const secret = (payload as { secret?: string }).secret;
    if (!code || !secret || !verifyTotp(code, secret)) {
      return res.status(401).json({ error: 'invalid verification code' });
    }
    await query(`UPDATE app_auth SET totp_secret = $1, totp_enabled = TRUE WHERE id = 1`, [secret]);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* Authenticated: change backup PIN (rate-limited on failure). */
router.post('/change-pin', requireAuth, async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };
    const rows = await appAuthInitializedRow();
    const row = rows[0];
    if (!row?.pin_hash) {
      return res.status(404).json({ error: 'auth not initialized' });
    }
    if (!currentPin || !verifyPin(currentPin, row.pin_hash)) {
      const attempts = (row.pin_attempts ?? 0) + 1;
      let lockUntil: Date | null = null;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        lockUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
      }
      await query(
        `UPDATE app_auth SET pin_attempts = $1, pin_locked_until = $2 WHERE id = 1`,
        [attempts, lockUntil],
      );
      if (lockUntil) {
        return res.status(429).json({ error: 'too many failed PIN attempts', retryAfter: PIN_LOCK_MINUTES * 60 });
      }
      return res.status(401).json({ error: 'invalid current PIN' });
    }
    if (!newPin || !/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'new PIN must be 6 digits' });
    }
    await query(
      `UPDATE app_auth SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = 1`,
      [hashPin(newPin)],
    );
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
