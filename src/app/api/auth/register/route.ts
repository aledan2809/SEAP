import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';

const registerSchema = z.object({
  name: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere'),
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Parola trebuie să aibă minim 6 caractere'),
  organizationName: z.string().optional(),
  cui: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, organizationName, cui } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilizator cu acest email există deja' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user first
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Create or link organization if CUI provided
    if (cui && organizationName) {
      // Check if organization with this CUI exists
      let organization = await prisma.organization.findUnique({
        where: { cui },
      });

      if (!organization) {
        organization = await prisma.organization.create({
          data: {
            name: organizationName,
            cui,
          },
        });
      }

      // Create UserOrganization link with OWNER role for new org, MEMBER for existing
      const isNewOrg = !organization.createdAt ||
        (new Date().getTime() - organization.createdAt.getTime()) < 5000;

      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: isNewOrg ? 'OWNER' : 'MEMBER',
        },
      });

      // Set as active organization
      await prisma.user.update({
        where: { id: user.id },
        data: { activeOrganizationId: organization.id },
      });
    }

    await logAction({
      userId: user.id,
      userEmail: user.email,
      action: AuditActions.REGISTER,
      resource: 'user',
      resourceId: user.id,
      request,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la înregistrare' },
      { status: 500 }
    );
  }
}
