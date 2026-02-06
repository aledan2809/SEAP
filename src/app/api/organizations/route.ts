import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Numele trebuie să aibă minim 2 caractere'),
  cui: z.string().min(2, 'CUI invalid'),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

// POST - Create organization
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
      return NextResponse.json(
        { error: 'O organizație cu acest CUI există deja' },
        { status: 400 }
      );
    }

    // Create organization and link user
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        cui: data.cui,
        address: data.address || null,
        email: data.email || null,
        phone: data.phone || null,
      },
    });

    // Update user with organization
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        organizationId: organization.id,
        role: 'OWNER',
      },
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

// GET - List organizations (for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    return NextResponse.json({
      organization: user?.organization || null,
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea organizațiilor' },
      { status: 500 }
    );
  }
}
