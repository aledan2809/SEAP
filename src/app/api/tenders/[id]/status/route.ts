import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAction, AuditActions } from '@/lib/audit-log';

const statusSchema = z.object({
  status: z.enum([
    'NEW',
    'REVIEWING',
    'PREPARING',
    'SUBMITTED',
    'WON',
    'LOST',
    'CANCELLED',
    'IGNORED',
  ]),
});

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
    const body = await request.json();
    const { status } = statusSchema.parse(body);

    // Verify user has access to this tender
    const tender = await prisma.tender.findFirst({
      where: {
        id,
        organization: {
          userOrganizations: {
            some: { userId: session.user.id },
          },
        },
      },
    });

    if (!tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
    }

    // Update status
    const updatedTender = await prisma.tender.update({
      where: { id },
      data: { status },
    });

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.TENDER_UPDATE_STATUS,
      resource: 'tender',
      resourceId: id,
      details: { oldStatus: tender.status, newStatus: status },
      request,
    });

    return NextResponse.json({ success: true, tender: updatedTender });
  } catch (error) {
    console.error('Status update error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Status invalid' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Eroare la actualizarea statusului' },
      { status: 500 }
    );
  }
}
