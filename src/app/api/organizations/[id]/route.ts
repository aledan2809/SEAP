import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
});

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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user?.organization || user.organization.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only OWNER and ADMIN can update
    if (!['OWNER', 'ADMIN'].includes(user.role)) {
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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
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

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea organizației' },
      { status: 500 }
    );
  }
}
