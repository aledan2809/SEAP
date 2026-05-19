import { NextRequest, NextResponse } from 'next/server';
import { searchCpvNomenclature } from '@/lib/seap/cpv-nomenclature';

// Simple in-memory cache — resets on server restart (acceptable for static nomenclature)
const cache = new Map<string, ReturnType<typeof searchCpvNomenclature>>();

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!cache.has(q)) {
    cache.set(q, searchCpvNomenclature(q, 20));
    // Evict if cache grows too large
    if (cache.size > 500) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
  }

  return NextResponse.json({ results: cache.get(q) });
}
