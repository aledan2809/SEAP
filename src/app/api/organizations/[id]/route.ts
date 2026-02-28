import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
});

// Helper to check user's access to organization
async function getUserOrgAccess(userId: string, organizationId: string) {
  return prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
}

// PATCH - Update organization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check user has access to this organization
    const userOrg = await getUserOrgAccess(session.user.id, id);

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only OWNER and ADMIN can update
    if (!['OWNER', 'ADMIN'].includes(userOrg.role)) {
      return NextResponse.json(
        { error: 'Nu ai permisiunea de a modifica organizația' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateOrganizationSchema.parse(body);

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        email: data.email || null,
        phone: data.phone,
      },
    });

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.ORG_UPDATE,
      resource: 'organization',
      resourceId: id,
      details: data,
      request,
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    console.error('Update organization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la actualizarea organizației' },
      { status: 500 }
    );
  }
}

// GET - Get organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check user has access to this organization
    const userOrg = await getUserOrgAccess(session.user.id, id);

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        userOrganizations: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { tenders: true, documents: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organizație negăsită' },
        { status: 404 }
      );
    }

    // Transform to include user role
    const members = organization.userOrganizations.map((uo) => ({
      ...uo.user,
      role: uo.role,
    }));

    return NextResponse.json({
      organization: {
        ...organization,
        members,
        userOrganizations: undefined, // Remove raw relation
      },
      userRole: userOrg.role,
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea organizației' },
      { status: 500 }
    );
  }
}

// POST - Switch to this organization (set as active)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check user has access to this organization
    const userOrg = await getUserOrgAccess(session.user.id, id);

    if (!userOrg) {
      return NextResponse.json(
        { error: 'Nu ai acces la această organizație' },
        { status: 403 }
      );
    }

    // Set as active organization
    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeOrganizationId: id },
    });

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.ORG_SWITCH,
      resource: 'organization',
      resourceId: id,
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Organizația a fost selectată',
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    return NextResponse.json(
      { error: 'Eroare la schimbarea organizației' },
      { status: 500 }
    );
  }
}
