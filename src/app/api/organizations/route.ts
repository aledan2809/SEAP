import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere').max(300, 'Numele e prea lung'),
  cui: z.string().min(2, 'CUI invalid').max(20, 'CUI prea lung'),
  address: z.string().max(500).optional(),
  email: z.string().email().max(320).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
});

// POST - Create organization and link to user
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Check if CUI already exists
      const existingOrg = await tx.organization.findUnique({
        where: { cui: data.cui },
      });

      if (existingOrg) {
        // Check if user already has access to this org
        const existingLink = await tx.userOrganization.findUnique({
          where: {
            userId_organizationId: {
              userId: session.user.id,
              organizationId: existingOrg.id,
            },
          },
        });

        if (existingLink) {
          return { error: 'Ai deja acces la această organizație', status: 400 };
        }

        // Link user to existing org as MEMBER
        await tx.userOrganization.create({
          data: {
            userId: session.user.id,
            organizationId: existingOrg.id,
            role: 'MEMBER',
          },
        });

        // Set as active organization if user doesn't have one
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
        });

        if (!user?.activeOrganizationId) {
          await tx.user.update({
            where: { id: session.user.id },
            data: { activeOrganizationId: existingOrg.id },
          });
        }

        return {
          success: true,
          organization: existingOrg,
          message: 'Te-ai alăturat organizației existente',
        };
      }

      // Create new organization
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          cui: data.cui,
          address: data.address || null,
          email: data.email || null,
          phone: data.phone || null,
        },
      });

      // Link user as OWNER
      await tx.userOrganization.create({
        data: {
          userId: session.user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      // Set as active organization
      await tx.user.update({
        where: { id: session.user.id },
        data: { activeOrganizationId: organization.id },
      });

      return { success: true, organization, isNew: true };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.isNew) {
      await logAction({
        userId: session.user.id,
        userEmail: session.user.email,
        action: AuditActions.ORG_CREATE,
        resource: 'organization',
        resourceId: result.organization.id,
        details: { name: data.name, cui: data.cui },
        request,
      });
    }

    return NextResponse.json(result);
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
export async function GET(request: NextRequest) {
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
