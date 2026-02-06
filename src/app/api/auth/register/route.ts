import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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

    // Create organization if CUI provided
    let organizationId: string | null = null;

    if (cui && organizationName) {
      // Check if organization with this CUI exists
      const existingOrg = await prisma.organization.findUnique({
        where: { cui },
      });

      if (existingOrg) {
        organizationId = existingOrg.id;
      } else {
        const newOrg = await prisma.organization.create({
          data: {
            name: organizationName,
            cui,
          },
        });
        organizationId = newOrg.id;
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organizationId,
        role: organizationId ? 'OWNER' : 'MEMBER',
      },
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
