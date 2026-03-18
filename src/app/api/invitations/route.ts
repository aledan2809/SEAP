import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/client';
import { invitationEmail } from '@/lib/email/invitation-template';
import { logAction, AuditActions } from '@/lib/audit-log';

const APP_URL = process.env.NEXTAUTH_URL || 'https://seap-assistant.vercel.app';

// GET /api/invitations - List invitations for current user's active organization
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { activeOrganization: true },
    });

    if (!user?.activeOrganizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    // Check if user is admin/owner
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const invitations = await prisma.invitation.findMany({
      where: { organizationId: user.activeOrganizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('[Invitations GET] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/invitations - Create and send invitation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { activeOrganization: true },
    });

    if (!user?.activeOrganizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    // Check if user is admin/owner
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role = 'MEMBER' } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Check if user already exists in organization
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        organizations: {
          where: { organizationId: user.activeOrganizationId },
        },
      },
    });

    if (existingUser && existingUser.organizations.length > 0) {
      return NextResponse.json(
        { error: 'User already in organization' },
        { status: 400 }
      );
    }

    // Check if invitation already exists
    const existing = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: user.activeOrganizationId,
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Invitation already sent' },
        { status: 400 }
      );
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        organizationId: user.activeOrganizationId,
        invitedById: user.id,
        role: ['OWNER', 'ADMIN', 'MEMBER'].includes(role) ? role : 'MEMBER',
        expiresAt,
      },
    });

    // Send email
    const acceptUrl = `${APP_URL}/invitations/accept?token=${invitation.token}`;
    const template = invitationEmail({
      organizationName: user.activeOrganization!.name,
      invitedByName: user.name || user.email,
      acceptUrl,
      expiresAt: expiresAt.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });

    const emailSent = await sendEmail({ to: email, ...template });

    // Audit log
    await logAction({
      userId: user.id,
      userEmail: user.email,
      action: AuditActions.ORG_INVITE,
      resource: 'invitation',
      resourceId: invitation.id,
      details: { email, organizationId: user.activeOrganizationId },
      request: req,
    });

    return NextResponse.json({
      invitation,
      emailSent,
    });
  } catch (error) {
    console.error('[Invitations POST] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/invitations?id=xxx - Cancel invitation
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.activeOrganizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    const invitationId = req.nextUrl.searchParams.get('id');
    if (!invitationId) {
      return NextResponse.json({ error: 'Missing invitation ID' }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organizationId !== user.activeOrganizationId) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if user is admin/owner
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Invitations DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
