import { NextRequest, NextResponse } from 'next/server';

/**
 * Security middleware — Origin/Referer validation for mutating API requests.
 * Prevents CSRF attacks by ensuring POST/PUT/PATCH/DELETE requests
 * originate from the same site or are legitimate API calls.
 */

const PRODUCTION_ORIGINS = [
  'https://seap.knowbest.ro',
  'https://seap-assistant.vercel.app',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3011',
];

const ALLOWED_ORIGINS = new Set([
  ...PRODUCTION_ORIGINS,
  ...(process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
]);

// Routes that accept external requests (webhooks, cron jobs)
const EXTERNAL_API_PATHS = [
  '/api/webhooks/',
  '/api/scan',
  '/api/notifications/deadline-check',
];

function isExternalRoute(pathname: string): boolean {
  return EXTERNAL_API_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { method, nextUrl } = request;
  const pathname = nextUrl.pathname;

  // Only check mutating requests to API routes
  if (!pathname.startsWith('/api/') || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Skip origin check for webhook/cron routes (they have their own auth)
  if (isExternalRoute(pathname)) {
    return NextResponse.next();
  }

  // Validate Origin or Referer header
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: 'Forbidden — invalid origin' }, { status: 403 });
    }
  } else if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.has(refererOrigin)) {
        return NextResponse.json({ error: 'Forbidden — invalid referer' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden — malformed referer' }, { status: 403 });
    }
  } else {
    // No Origin or Referer header present.
    // Block the request — all legitimate browser requests include Origin on
    // POST/PUT/PATCH/DELETE, and server-to-server callers should use the
    // webhook/cron routes which are whitelisted above.
    return NextResponse.json({ error: 'Forbidden — missing origin' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
