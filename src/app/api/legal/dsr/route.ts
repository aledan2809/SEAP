import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const LEGAL_URL = process.env.LEGAL_API_URL || 'https://legal.knowbest.ro';
const APP_SLUG = 'seap';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.LEGAL_API_KEY?.trim();
  if (!apiKey) {
    console.error('[dsr] LEGAL_API_KEY not configured');
    return NextResponse.json({ error: 'Legal Hub not configured' }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = json as Record<string, unknown>;
  const type = body.type as string | undefined;
  const description = body.description as string | undefined;

  if (!type || !['export', 'delete'].includes(type)) {
    return NextResponse.json({ error: "type must be 'export' or 'delete'" }, { status: 400 });
  }
  if (description !== undefined && typeof description !== 'string') {
    return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
  }
  if (typeof description === 'string' && description.length > 5000) {
    return NextResponse.json({ error: 'description too long (max 5000 chars)' }, { status: 400 });
  }

  try {
    const res = await fetch(`${LEGAL_URL.replace(/\/$/, '')}/api/v1/dsr/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-legal-api-key': apiKey,
      },
      body: JSON.stringify({
        appSlug: APP_SLUG,
        globalUserId: `seap:${session.user.id}`,
        email: session.user.email ?? '',
        type,
        description: description || undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      console.error('[dsr] Legal Hub returned non-OK:', res.status, err?.error ?? 'no detail');
      return NextResponse.json(
        { error: (err?.error as string) ?? `Legal Hub HTTP ${res.status}` },
        { status: [401, 403, 503].includes(res.status) ? 502 : res.status }
      );
    }

    return NextResponse.json(await res.json(), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      console.error('[dsr] Legal Hub request timed out:', session.user.id);
      return NextResponse.json({ error: 'Legal Hub request timed out' }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dsr] request error:', session.user.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
