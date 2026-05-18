import { NextRequest, NextResponse } from 'next/server';
import { searchCpvNomenclature } from '@/lib/seap/cpv-nomenclature';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const results = searchCpvNomenclature(q, 20);
  return NextResponse.json({ results });
}
