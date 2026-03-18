import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAction, AuditActions } from '@/lib/audit-log';

// Dynamic imports to avoid SSR issues with @react-pdf/renderer
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Fetch tender with analysis
    const tender = await prisma.tender.findFirst({
      where: {
        id,
        organization: {
          userOrganizations: {
            some: { userId: session.user.id },
          },
        },
      },
      include: {
        analysis: true,
        organization: true,
      },
    });

    if (!tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
    }

    // Generate PDF - dynamic import to avoid SSR issues
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { TenderPDFDocument } = await import('@/lib/pdf/tender-report');
    const pdfBuffer = await renderToBuffer(TenderPDFDocument({ tender }));

    // Audit log
    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.TENDER_EXPORT_PDF,
      resource: 'tender',
      resourceId: tender.id,
      request,
    });

    // Return PDF - convert Buffer to Uint8Array
    const filename = `${tender.seapId}-raport.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[PDF] Generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
