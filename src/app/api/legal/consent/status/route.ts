import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const LEGAL_URL = process.env.LEGAL_API_URL || 'https://legal.knowbest.ro';
const APP_SLUG = 'seap';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const globalUserId = `seap:${session.user.id}`;

  try {
    const res = await fetch(
      `${LEGAL_URL}/api/v1/consent/status?appSlug=${APP_SLUG}&globalUserId=${encodeURIComponent(globalUserId)}`,
      { headers: { 'x-app-slug': APP_SLUG }, cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Legal Hub error: ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Failed to check consent status' }, { status: 502 });
  }
}
