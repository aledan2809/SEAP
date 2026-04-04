import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/auth/providers-info
 * Returns which authentication providers are configured.
 * Used by the login page to conditionally render OAuth buttons.
 */
export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.api);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    return NextResponse.json({
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  } catch (error) {
    console.error('[Providers Info GET] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
