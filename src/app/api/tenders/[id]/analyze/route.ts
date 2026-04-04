import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { analyzeWithClaude } from '@/lib/ai/analyzer';
import { Prisma } from '@prisma/client';
import { logAction, AuditActions } from '@/lib/audit-log';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit expensive AI analysis
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.analysis);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Prea multe cereri de analiză. Încearcă din nou în curând.' },
        { status: 429 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
      include: {
        documents: {
          select: {
            filename: true,
            docType: true,
            ocrText: true,
          },
        },
        organization: {
          select: {
            name: true,
            cui: true,
            cpvCodes: true,
            keywords: true,
          },
        },
      },
    });

    if (!tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
    }

    // Check if ANTHROPIC_API_KEY is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      // Create mock analysis for demo
      const analysis = await prisma.tenderAnalysis.upsert({
        where: { tenderId: id },
        update: {
          strengths: [
            'Avem experiență în proiecte similare',
            'Prețul poate fi competitiv',
          ],
          weaknesses: [
            'Necesită verificare cerințe tehnice',
            'Termen limită strâns',
          ],
          opportunities: [
            'Posibilitate de extindere contract',
            'Autoritate contractantă de referință',
          ],
          threats: ['Concurență puternică pe acest segment'],
          recommendation: 'CAUTION',
          aiSummary:
            'Această licitație prezintă potențial, dar necesită analiză atentă a cerințelor tehnice și a termenelor. Recomandam revizuirea documentației complete înainte de decizia finală.',
          modelUsed: 'mock',
          confidence: 0.75,
          analyzedAt: new Date(),
        },
        create: {
          tenderId: id,
          strengths: [
            'Avem experiență în proiecte similare',
            'Prețul poate fi competitiv',
          ],
          weaknesses: [
            'Necesită verificare cerințe tehnice',
            'Termen limită strâns',
          ],
          opportunities: [
            'Posibilitate de extindere contract',
            'Autoritate contractantă de referință',
          ],
          threats: ['Concurență puternică pe acest segment'],
          recommendation: 'CAUTION',
          aiSummary:
            'Această licitație prezintă potențial, dar necesită analiză atentă a cerințelor tehnice și a termenelor. Recomandam revizuirea documentației complete înainte de decizia finală.',
          modelUsed: 'mock',
          confidence: 0.75,
        },
      });

      return NextResponse.json({
        success: true,
        analysis,
        note: 'Analiză demo. Configurează ANTHROPIC_API_KEY pentru analiză reală.',
      });
    }

    // Real AI analysis with Claude
    const tenderForAnalysis = {
      id: tender.id,
      title: tender.title,
      description: tender.description,
      contractingAuth: tender.contractingAuth,
      contractingAuthCui: tender.contractingAuthCui,
      estimatedValue: tender.estimatedValue ? Number(tender.estimatedValue) : null,
      currency: tender.currency,
      cpvCode: tender.cpvCode,
      cpvDescription: tender.cpvDescription,
      procedureType: tender.procedureType,
      contractType: tender.contractType,
      publicationDate: tender.publicationDate,
      submissionDeadline: tender.submissionDeadline,
      organization: tender.organization,
      documents: tender.documents,
    };

    const analysisResult = await analyzeWithClaude(tenderForAnalysis);

    // Save analysis to database
    const analysis = await prisma.tenderAnalysis.upsert({
      where: { tenderId: id },
      update: {
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
        opportunities: analysisResult.opportunities,
        threats: analysisResult.threats,
        recommendation: analysisResult.recommendation,
        aiSummary: analysisResult.aiSummary,
        aiNotes: analysisResult.aiNotes,
        qualificationReqs: analysisResult.qualificationReqs as Prisma.InputJsonValue | undefined,
        technicalSpecs: analysisResult.technicalSpecs as Prisma.InputJsonValue | undefined,
        evaluationCriteria: analysisResult.evaluationCriteria as Prisma.InputJsonValue | undefined,
        keyDates: analysisResult.keyDates as Prisma.InputJsonValue | undefined,
        modelUsed: analysisResult.modelUsed,
        confidence: analysisResult.confidence,
        analyzedAt: new Date(),
      },
      create: {
        tenderId: id,
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
        opportunities: analysisResult.opportunities,
        threats: analysisResult.threats,
        recommendation: analysisResult.recommendation,
        aiSummary: analysisResult.aiSummary,
        aiNotes: analysisResult.aiNotes,
        qualificationReqs: analysisResult.qualificationReqs as Prisma.InputJsonValue | undefined,
        technicalSpecs: analysisResult.technicalSpecs as Prisma.InputJsonValue | undefined,
        evaluationCriteria: analysisResult.evaluationCriteria as Prisma.InputJsonValue | undefined,
        keyDates: analysisResult.keyDates as Prisma.InputJsonValue | undefined,
        modelUsed: analysisResult.modelUsed,
        confidence: analysisResult.confidence,
      },
    });

    // Update tender status to REVIEWING if it was NEW
    if (tender.status === 'NEW') {
      await prisma.tender.update({
        where: { id },
        data: { status: 'REVIEWING' },
      });
    }

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.ANALYSIS_RUN,
      resource: 'tender',
      resourceId: id,
      details: { recommendation: analysis.recommendation, modelUsed: analysis.modelUsed },
      request,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: 'Eroare la analiza licitației' },
      { status: 500 }
    );
  }
}
