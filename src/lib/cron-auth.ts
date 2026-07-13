import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time verification of a cron/webhook `Authorization` header against
 * `CRON_SECRET`.
 *
 * Both sides are hashed to a fixed-length SHA-256 digest before comparison so
 * that `timingSafeEqual` never throws on length mismatch and the secret length
 * is not leaked through an early return. Fail-secure: returns false when the
 * secret is not configured or the header is missing.
 */
export function verifyCronAuth(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const provided = createHash('sha256').update(authHeader).digest();

  return timingSafeEqual(expected, provided);
}
