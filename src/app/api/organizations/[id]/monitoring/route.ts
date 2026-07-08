import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logAction, AuditActions } from '@/lib/audit-log';

const updateMonitoringSchema = z.object({
  cpvCodes: z.array(z.string().max(20).regex(/^\d{8}-\d$/, 'Format CPV invalid')).max(50, 'Maximum 50 CPV codes').optional(),
  keywords: z.array(z.string().min(1).max(100)).max(100, 'Maximum 100 keywords').optional(),
  minValue: z.number().min(0).nullable().optional(),
  maxValue: z.number().min(0).nullable().optional(),
});

// PATCH - Update monitoring settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.sensitive);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check user has access to this organization
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = updateMonitoringSchema.parse(body);

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        cpvCodes: data.cpvCodes,
        keywords: data.keywords,
        minValue: data.minValue !== null && data.minValue !== undefined
          ? new Decimal(data.minValue)
          : null,
        maxValue: data.maxValue !== null && data.maxValue !== undefined
          ? new Decimal(data.maxValue)
          : null,
      },
    });

    // Audit: changing CPV codes / keywords / value thresholds alters which tenders
    // match this org — a business-meaningful configuration change worth a trail.
    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.MONITORING_UPDATE,
      resource: 'organization',
      resourceId: id,
      details: data,
      request,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        cpvCodes: organization.cpvCodes,
        keywords: organization.keywords,
        minValue: organization.minValue,
        maxValue: organization.maxValue,
      },
    });
  } catch (error) {
    console.error('Update monitoring error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la actualizarea setărilor de monitorizare' },
      { status: 500 }
    );
  }
}

// GET - Get monitoring settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.api);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify user has access to this organization
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        cpvCodes: true,
        keywords: true,
        minValue: true,
        maxValue: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organizație negăsită' },
        { status: 404 }
      );
    }

    return NextResponse.json({ monitoring: organization });
  } catch (error) {
    console.error('Get monitoring error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea setărilor' },
      { status: 500 }
    );
  }
}
