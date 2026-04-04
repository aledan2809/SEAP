import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/organizations/cpv-codes
 * Returnează toate codurile CPV de monitorizat pentru n8n
 */
export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.api);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Require API key - reject if not configured or invalid
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.N8N_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obține toate organizațiile cu codurile lor CPV
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        cui: true,
        cpvCodes: true,
        keywords: true,
        minValue: true,
        maxValue: true,
      },
    });

    // Dacă nu există organizații sau niciuna nu are coduri CPV setate,
    // returnează codurile CPV IT default
    const hasCustomCpvCodes = organizations.some(
      (org) => org.cpvCodes && org.cpvCodes.length > 0
    );

    if (!hasCustomCpvCodes) {
      // Returnează un subset de coduri CPV IT (cele mai comune)
      const defaultCpvCodes = [
        '30213100-6', // Laptopuri
        '30213300-8', // Desktop
        '30231300-0', // Monitoare
        '30232110-8', // Imprimante laser
        '48000000-8', // Software
        '72000000-5', // Servicii IT
        '72212000-4', // Programare software aplicație
        '72230000-6', // Dezvoltare software personalizat
      ];

      return NextResponse.json({
        organizations: [],
        cpvCodes: defaultCpvCodes,
        source: 'default',
        message: 'Using default IT CPV codes. Configure organization settings to customize.',
      });
    }

    // Extrage toate codurile CPV unice
    const allCpvCodes = new Set<string>();
    organizations.forEach((org) => {
      org.cpvCodes?.forEach((code) => allCpvCodes.add(code));
    });

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        cui: org.cui,
        cpvCodes: org.cpvCodes,
        keywords: org.keywords,
        filters: {
          minValue: org.minValue,
          maxValue: org.maxValue,
        },
      })),
      cpvCodes: Array.from(allCpvCodes),
      source: 'custom',
    });
  } catch (error) {
    console.error('Error fetching CPV codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
