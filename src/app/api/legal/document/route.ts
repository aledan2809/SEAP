import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LEGAL_URL = process.env.LEGAL_API_URL || 'https://legal.knowbest.ro';
const APP_SLUG = 'seap';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (!type || !['tos', 'privacy', 'cookies'].includes(type)) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${LEGAL_URL}/api/v1/documents/latest?type=${type.toUpperCase()}&appSlug=${APP_SLUG}&renderTokens=true`,
      { headers: { 'x-app-slug': APP_SLUG }, cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Legal Hub error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json() as Record<string, unknown>;

    const tokens: Record<string, string> = {
      app_name: 'SEAP Assistant',
      app_slug: APP_SLUG,
      rendered_at: new Date().toISOString(),
    };

    let content = (data.contentMarkdown || data.content || '') as string;
    for (const [k, v] of Object.entries(tokens)) {
      content = content.replaceAll(`{${k}}`, v);
    }

    return NextResponse.json({
      contentMarkdown: content,
      versionId: data.versionId || data.id,
      version: data.version ?? null,
      entityName: data.entityName ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 502 });
  }
}
