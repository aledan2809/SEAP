import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const registerSchema = z.object({
  name: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere').max(200, 'Numele e prea lung'),
  email: z.string().email('Email invalid').max(320, 'Email prea lung'),
  password: z
    .string()
    .min(8, 'Parola trebuie să aibă minim 8 caractere')
    .max(128, 'Parola e prea lungă')
    .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
    .regex(/[a-z]/, 'Parola trebuie să conțină cel puțin o literă mică')
    .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră'),
  organizationName: z.string().max(300).optional(),
  cui: z.string().max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit registration attempts
    const ip = getClientIp(request);
    const limit = checkRateLimit(ip, RATE_LIMITS.auth);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Prea multe încercări. Reîncercați mai târziu.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, password, organizationName, cui } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Generic message to prevent email enumeration
      return NextResponse.json(
        { error: 'Înregistrarea nu a putut fi finalizată. Verificați datele și încercați din nou.' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Wrap all DB operations in a transaction to prevent partial state
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Create or link organization if CUI provided
      if (cui && organizationName) {
        const existingOrg = await tx.organization.findUnique({
          where: { cui },
        });

        if (existingOrg) {
          // Organization already exists — user must be invited to join.
          // Auto-joining by CUI is a security risk (anyone who knows the CUI can access org data).
          // User is created without org; they must accept an invitation later.
          console.warn(
            `[Register] User ${newUser.email} attempted to join existing org ${existingOrg.id} by CUI. ` +
            `Org join blocked — invitation required.`
          );
        } else {
          // New organization — user becomes OWNER
          const organization = await tx.organization.create({
            data: {
              name: organizationName,
              cui,
            },
          });

          await tx.userOrganization.create({
            data: {
              userId: newUser.id,
              organizationId: organization.id,
              role: 'OWNER',
            },
          });

          // Set as active organization
          await tx.user.update({
            where: { id: newUser.id },
            data: { activeOrganizationId: organization.id },
          });
        }
      }

      return newUser;
    });

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
