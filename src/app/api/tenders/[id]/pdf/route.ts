import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateTenderPdf } from '@/lib/pdf/generator';
import { logAction, AuditActions } from '@/lib/audit-log';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

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
      organization: { select: { name: true } },
    },
  });

  if (!tender) {
    return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
  }

  const pdfBuffer = generateTenderPdf({
    tender: {
      title: tender.title,
      seapId: tender.seapId,
      seapUrl: tender.seapUrl,
      description: tender.description,
      contractingAuth: tender.contractingAuth,
      contractingAuthCui: tender.contractingAuthCui,
      estimatedValue: tender.estimatedValue ? Number(tender.estimatedValue).toLocaleString('ro-RO') : null,
      currency: tender.currency,
      cpvCode: tender.cpvCode,
      cpvDescription: tender.cpvDescription,
      procedureType: tender.procedureType,
      contractType: tender.contractType,
      publicationDate: tender.publicationDate
        ? new Date(tender.publicationDate).toLocaleDateString('ro-RO')
        : null,
      submissionDeadline: tender.submissionDeadline
        ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : null,
      matchScore: tender.matchScore,
      status: tender.status,
    },
    analysis: tender.analysis
      ? {
          recommendation: tender.analysis.recommendation,
          aiSummary: tender.analysis.aiSummary || '',
          strengths: tender.analysis.strengths as string[],
          weaknesses: tender.analysis.weaknesses as string[],
          opportunities: tender.analysis.opportunities as string[],
          threats: tender.analysis.threats as string[],
          confidence: tender.analysis.confidence || 0,
          qualificationReqs: tender.analysis.qualificationReqs as Record<string, unknown> | null,
          technicalSpecs: tender.analysis.technicalSpecs as Record<string, unknown> | null,
          evaluationCriteria: tender.analysis.evaluationCriteria as Record<string, unknown> | null,
          keyDates: tender.analysis.keyDates as Record<string, unknown> | null,
        }
      : null,
    organizationName: tender.organization.name,
    generatedAt: new Date().toLocaleDateString('ro-RO', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
  });

  await logAction({
    userId: session.user.id,
    userEmail: session.user.email,
    action: AuditActions.TENDER_EXPORT_PDF,
    resource: 'tender',
    resourceId: id,
    details: { seapId: tender.seapId },
  });

  const filename = `raport-${tender.seapId}-${Date.now()}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  });
}
