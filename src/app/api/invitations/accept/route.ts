import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAction, AuditActions } from '@/lib/audit-log';

// POST — accept an invitation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Trebuie să fii autentificat' }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: 'Token lipsă' }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitație invalidă' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitația a fost deja utilizată' }, { status: 400 });
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
    return NextResponse.json({ error: 'Invitația a expirat' }, { status: 400 });
  }

  // Verify email matches (or allow any authenticated user)
  if (invitation.email !== session.user.email) {
    return NextResponse.json({
      error: `Invitația este pentru ${invitation.email}. Te-ai autentificat cu ${session.user.email}.`,
    }, { status: 403 });
  }

  // Check if already member
  const existing = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId: invitation.organizationId },
  });

  if (existing) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } });
    return NextResponse.json({ success: true, message: 'Ești deja membru', organizationId: invitation.organizationId });
  }

  // Add user to organization
  await prisma.$transaction([
    prisma.userOrganization.create({
      data: {
        userId: session.user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    }),
    // Set as active org if user doesn't have one
    prisma.user.updateMany({
      where: { id: session.user.id, activeOrganizationId: null },
      data: { activeOrganizationId: invitation.organizationId },
    }),
  ]);

  await logAction({
    userId: session.user.id,
    userEmail: session.user.email,
    action: AuditActions.ORG_INVITE_ACCEPT,
    resource: 'invitation',
    resourceId: invitation.id,
    details: { organizationId: invitation.organizationId, role: invitation.role },
    request,
  });

  return NextResponse.json({
    success: true,
    message: `Te-ai alăturat ${invitation.organization.name}`,
    organizationId: invitation.organizationId,
  });
}
