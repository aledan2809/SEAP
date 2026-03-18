import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/admin/audit-logs - Get audit logs (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user?.activeOrganizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    // Check if user is admin/owner of active organization
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') || undefined;
    const userId = searchParams.get('userId') || undefined;

    // Build where clause
    const where: {
      userId?: string;
      action?: string;
    } = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;

    // Get audit logs
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Audit Logs GET] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
