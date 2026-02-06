import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const updateMonitoringSchema = z.object({
  cpvCodes: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
});

// PATCH - Update monitoring settings
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

    const body = await request.json();
    const data = updateMonitoringSchema.parse(body);

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        cpvCodes: data.cpvCodes,
        keywords: data.keywords,
        minValue: data.minValue !== null && data.minValue !== undefined
          ? new Decimal(data.minValue)
          : null,
        maxValue: data.maxValue !== null && data.maxValue !== undefined
          ? new Decimal(data.maxValue)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        cpvCodes: organization.cpvCodes,
        keywords: organization.keywords,
        minValue: organization.minValue,
        maxValue: organization.maxValue,
      },
    });
  } catch (error) {
    console.error('Update monitoring error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la actualizarea setărilor de monitorizare' },
      { status: 500 }
    );
  }
}

// GET - Get monitoring settings
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
      select: {
        id: true,
        cpvCodes: true,
        keywords: true,
        minValue: true,
        maxValue: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organizație negăsită' },
        { status: 404 }
      );
    }

    return NextResponse.json({ monitoring: organization });
  } catch (error) {
    console.error('Get monitoring error:', error);
    return NextResponse.json(
      { error: 'Eroare la obținerea setărilor' },
      { status: 500 }
    );
  }
}
