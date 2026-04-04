import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

// GET /api/admin/audit-logs - Get audit logs (admin only)
// Allowed action values for filtering
const ALLOWED_ACTIONS = new Set([
  'LOGIN', 'REGISTER', 'LOGOUT',
  'SCAN_COMPLETE', 'TENDER_ANALYZE', 'TENDER_STATUS_CHANGE', 'TENDER_EXPORT_PDF',
  'ORG_CREATE', 'ORG_UPDATE', 'ORG_SWITCH', 'ORG_INVITE',
  'INVITATION_ACCEPT',
  'SETTINGS_UPDATE',
  'USER_PROFILE_UPDATE',
  'DOCUMENT_DOWNLOAD',
]);

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.sensitive);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

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

    // Get query params with safe bounds
    const searchParams = req.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);
    const action = searchParams.get('action') || undefined;
    const userId = searchParams.get('userId') || undefined;

    // Get user IDs within the active organization for scoping
    const orgMembers = await prisma.userOrganization.findMany({
      where: { organizationId: user.activeOrganizationId },
      select: { userId: true },
    });
    const orgUserIds = orgMembers.map((m) => m.userId);

    // Build where clause — scoped to organization members only
    const where: {
      userId?: string | { in: string[] };
      action?: string;
    } = {
      userId: userId && orgUserIds.includes(userId)
        ? userId
        : { in: orgUserIds },
    };

    if (action && ALLOWED_ACTIONS.has(action)) where.action = action;

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
