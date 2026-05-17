import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createHash, createHmac, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const LEGAL_URL = process.env.LEGAL_API_URL || 'https://legal.knowbest.ro';
const APP_SLUG = 'seap';
const HMAC_KEY = process.env.LEGAL_HMAC_KEY || '';
const SKIP_HMAC = process.env.SKIP_LEGAL_HMAC === '1';

function buildHmacSignature(bodyStr: string, timestamp: string, nonce: string, globalUserId: string): string {
  const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
  const message = `${APP_SLUG}:${timestamp}:${nonce}:${globalUserId}:${bodyHash}`;
  return createHmac('sha256', HMAC_KEY).update(message).digest('hex');
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { documentVersionId, consentText, method } = body;

  if (!documentVersionId || !consentText) {
    return NextResponse.json({ error: 'documentVersionId and consentText are required' }, { status: 400 });
  }

  const globalUserId = `seap:${session.user.id}`;
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');

  const bodyObj = {
    documentVersionId,
    consentText,
    method: method || 'IN_APP',
    globalUserId,
    appSlug: APP_SLUG,
  };
  const bodyStr = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-app-slug': APP_SLUG,
  };

  if (!SKIP_HMAC && HMAC_KEY) {
    headers['x-hmac-timestamp'] = timestamp;
    headers['x-hmac-nonce'] = nonce;
    headers['x-hmac-signature'] = buildHmacSignature(bodyStr, timestamp, nonce, globalUserId);
  }

  try {
    const res = await fetch(`${LEGAL_URL}/api/v1/consent/record`, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({ error: err.error || `Legal Hub error: ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json(), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 502 });
  }
}
