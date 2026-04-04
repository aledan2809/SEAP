/**
 * In-memory rate limiter for API endpoints.
 * Tracks requests per IP with configurable limits and time windows.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Namespace to separate different limiters */
  namespace: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const { max, windowSeconds, namespace } = config;
  const windowMs = windowSeconds * 1000;

  if (!stores.has(namespace)) {
    stores.set(namespace, new Map());
  }
  const store = stores.get(namespace)!;

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/** Pre-configured rate limits for different endpoint types */
export const RATE_LIMITS = {
  /** Auth endpoints (login, register): 10 req/min per IP */
  auth: { max: 10, windowSeconds: 60, namespace: 'auth' },
  /** General API endpoints: 60 req/min per IP */
  api: { max: 60, windowSeconds: 60, namespace: 'api' },
  /** Sensitive operations (invitations, settings): 20 req/min per IP */
  sensitive: { max: 20, windowSeconds: 60, namespace: 'sensitive' },
  /** Webhook endpoints: 100 req/min per IP */
  webhook: { max: 100, windowSeconds: 60, namespace: 'webhook' },
  /** Cron endpoints: 5 req/min per IP */
  cron: { max: 5, windowSeconds: 60, namespace: 'cron' },
  /** Expensive AI analysis: 5 req/min per IP */
  analysis: { max: 5, windowSeconds: 60, namespace: 'analysis' },
  /** SEAP scan: 3 req/min per IP */
  scan: { max: 3, windowSeconds: 60, namespace: 'scan' },
} as const;

/** Extract client IP from request headers.
 * Prefers Vercel/Cloudflare trusted headers over x-forwarded-for
 * which can be spoofed by attackers to bypass rate limiting. */
export function getClientIp(request: Request): string {
  // Vercel sets this header from the actual connection — cannot be spoofed
  const vercelIp = request.headers.get('x-real-ip');
  if (vercelIp) return vercelIp.trim();

  // Cloudflare sets this from the actual connection
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  // Fallback: x-forwarded-for — take the LAST entry (closest proxy)
  // instead of the first (client-supplied and spoofable)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean);
    // In Vercel/reverse-proxy setups, the rightmost IP is added by the
    // trusted proxy. Take second-to-last if there are multiple (the proxy
    // itself is last), or last if only one.
    return parts.length > 1 ? parts[parts.length - 2] : parts[0] || 'unknown';
  }

  return 'unknown';
}
