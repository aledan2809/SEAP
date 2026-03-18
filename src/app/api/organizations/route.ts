import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere'),
  cui: z.string().min(2, 'CUI invalid'),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

// POST - Create organization and link to user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);

    // Check if CUI already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { cui: data.cui },
    });

    if (existingOrg) {
      // Check if user already has access to this org
      const existingLink = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: existingOrg.id,
          },
        },
      });

      if (existingLink) {
        return NextResponse.json(
          { error: 'Ai deja acces la această organizație' },
          { status: 400 }
        );
      }

      // Link user to existing org as MEMBER
      await prisma.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: existingOrg.id,
          role: 'MEMBER',
        },
      });

      // Set as active organization if user doesn't have one
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user?.activeOrganizationId) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { activeOrganizationId: existingOrg.id },
        });
      }

      return NextResponse.json({
        success: true,
        organization: existingOrg,
        message: 'Te-ai alăturat organizației existente',
      });
    }

    // Create new organization
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        cui: data.cui,
        address: data.address || null,
        email: data.email || null,
        phone: data.phone || null,
      },
    });

    // Link user as OWNER
    await prisma.userOrganization.create({
      data: {
        userId: session.user.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    });

    // Set as active organization
    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeOrganizationId: organization.id },
    });

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.ORG_CREATE,
      resource: 'organization',
      resourceId: organization.id,
      details: { name: data.name, cui: data.cui },
      request,
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    console.error('Create organization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la crearea organizației' },
      { status: 500 }
    );
  }
}

// GET - List user's organizations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all organizations user has access to
    const userOrgs = await prisma.userOrganization.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: { tenders: true, documents: true },
            },
          },
        },
      },
    });

    // Get user's active organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activeOrganizationId: true },
    });

    const organizations = userOrgs.map((uo) => ({
      ...uo.organization,
      role: uo.role,
      isActive: uo.organizationId === user?.activeOrganizationId,
    }));

    // Also return active organization separately for convenience
    const activeOrganization = organizations.find((o) => o.isActive) || null;

    return NextResponse.json({
      organizations,
      activeOrganization,
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea organizațiilor' },
      { status: 500 }
    );
  }
}
