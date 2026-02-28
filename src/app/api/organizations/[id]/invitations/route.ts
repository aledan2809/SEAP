import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/client';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

const APP_URL = process.env.NEXTAUTH_URL || 'https://seap-assistant.vercel.app';

// POST — send invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is OWNER or ADMIN of this org
  const membership = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    include: { organization: true },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, role } = parsed.data;

  // Check if user already in org
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.userOrganization.findFirst({
      where: { userId: existingUser.id, organizationId: id },
    });
    if (existingMembership) {
      return NextResponse.json({ error: 'Utilizatorul este deja membru' }, { status: 409 });
    }
  }

  // Check for pending invitation
  const existingInvite = await prisma.invitation.findFirst({
    where: { email, organizationId: id, status: 'pending' },
  });
  if (existingInvite) {
    return NextResponse.json({ error: 'Invitație deja trimisă' }, { status: 409 });
  }

  // Create invitation (expires in 7 days)
  const invitation = await prisma.invitation.create({
    data: {
      email,
      organizationId: id,
      role: role as 'ADMIN' | 'MEMBER',
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Send email
  const acceptUrl = `${APP_URL}/invitations/accept?token=${invitation.token}`;
  await sendEmail({
    to: email,
    subject: `Invitație: ${membership.organization.name} pe SEAP Assistant`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2>Ai fost invitat!</h2>
        <p><strong>${session.user.name || session.user.email}</strong> te-a invitat să te alături organizației <strong>${membership.organization.name}</strong> pe SEAP Assistant.</p>
        <p>Rol: <strong>${role === 'ADMIN' ? 'Administrator' : 'Membru'}</strong></p>
        <p style="margin-top:24px;">
          <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;">Acceptă Invitația</a>
        </p>
        <p style="margin-top:16px;color:#888;font-size:13px;">Invitația expiră în 7 zile.</p>
      </div>
    `,
    text: `Ai fost invitat la ${membership.organization.name}. Acceptă: ${acceptUrl}`,
  });

  await logAction({
    userId: session.user.id,
    userEmail: session.user.email,
    action: AuditActions.ORG_INVITE,
    resource: 'invitation',
    resourceId: invitation.id,
    details: { email, role, organizationId: id },
    request,
  });

  return NextResponse.json({ success: true, invitation: { id: invitation.id, email, role } });
}

// GET — list invitations for this org
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const membership = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId: id },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { organizationId: id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invitations });
}
