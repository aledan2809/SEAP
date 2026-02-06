import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import {
  downloadSeapDocument,
  detectDocumentType,
  type DownloadResult,
} from '@/lib/seap/downloader';
import { processDocumentOcr, isOcrSupported } from '@/lib/ocr/client';
import { getFile } from '@/lib/storage';

/**
 * Webhook endpoint pentru n8n
 * Primește evenimente de la workflow-urile n8n
 */

const webhookSchema = z.object({
  event: z.enum([
    'tender_found',
    'documents_downloaded',
    'analysis_complete',
    'clarification_published',
    'deadline_approaching',
    'tender_updated',
  ]),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().optional(),
});

const tenderDataSchema = z.object({
  seapId: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  contractingAuth: z.string(),
  contractingAuthCui: z.string().optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  currency: z.string().optional().default('RON'),
  cpvCode: z.string(),
  cpvDescription: z.string().optional().nullable(),
  procedureType: z.string().optional().default('unknown'),
  contractType: z.string().optional().nullable(),
  publicationDate: z.string().optional().nullable(),
  submissionDeadline: z.string().optional().nullable(),
  seapUrl: z.string(),
  documents: z
    .array(
      z.object({
        url: z.string(),
        filename: z.string().optional(),
      })
    )
    .optional(),
});

const documentsDataSchema = z.object({
  tenderId: z.string(),
  documents: z.array(
    z.object({
      url: z.string(),
      filename: z.string().optional(),
    })
  ),
});

const analysisDataSchema = z.object({
  tenderId: z.string(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
  threats: z.array(z.string()).optional(),
  recommendation: z.enum(['GO', 'CAUTION', 'NO_GO']).optional(),
  aiSummary: z.string().optional(),
  confidence: z.number().optional(),
});

const clarificationDataSchema = z.object({
  tenderId: z.string(),
  seapId: z.string().optional(),
  title: z.string(),
  content: z.string().optional(),
  documentUrl: z.string().optional(),
  publishedAt: z.string().optional(),
});

const deadlineDataSchema = z.object({
  tenderId: z.string(),
  seapId: z.string().optional(),
  deadline: z.string(),
  daysRemaining: z.number(),
});

const tenderUpdateDataSchema = z.object({
  tenderId: z.string().optional(),
  seapId: z.string(),
  changes: z.record(z.string(), z.unknown()),
  updatedAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verifică API key (opțional)
    const apiKey = request.headers.get('x-api-key');
    if (process.env.N8N_API_KEY && apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event, data } = webhookSchema.parse(body);

    // Log webhook-ul
    const log = await prisma.webhookLog.create({
      data: {
        source: 'n8n',
        event,
        payload: body,
        status: 'received',
      },
    });

    let result: unknown = null;

    // Procesează evenimentul
    switch (event) {
      case 'tender_found':
        result = await handleTenderFound(data, log.id);
        break;
      case 'documents_downloaded':
        result = await handleDocumentsDownloaded(data, log.id);
        break;
      case 'analysis_complete':
        result = await handleAnalysisComplete(data, log.id);
        break;
      case 'clarification_published':
        result = await handleClarificationPublished(data, log.id);
        break;
      case 'deadline_approaching':
        result = await handleDeadlineApproaching(data, log.id);
        break;
      case 'tender_updated':
        result = await handleTenderUpdated(data, log.id);
        break;
    }

    // Actualizează log-ul
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: 'processed' },
    });

    return NextResponse.json({ success: true, logId: log.id, result });
  } catch (error) {
    console.error('Webhook error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ==================== HANDLERS ====================

async function handleTenderFound(data: Record<string, unknown>, logId: string) {
  try {
    const tenderData = tenderDataSchema.parse(data);

    // Găsește toate organizațiile care monitorizează acest cod CPV
    const organizations = await prisma.organization.findMany({
      where: {
        OR: [
          { cpvCodes: { has: tenderData.cpvCode } },
          { cpvCodes: { isEmpty: true } }, // Organizații fără CPV setat primesc toate
        ],
      },
    });

    // Dacă nu există organizații, folosește prima organizație (sau skip)
    if (organizations.length === 0) {
      // Creează tender pentru "sistem" - va fi vizibil tuturor
      const firstOrg = await prisma.organization.findFirst();
      if (!firstOrg) {
        console.log('No organizations found, skipping tender');
        return { skipped: true, reason: 'no_organizations' };
      }
      organizations.push(firstOrg);
    }

    const results = [];

    for (const org of organizations) {
      // Verifică dacă tender-ul există deja pentru această organizație
      const existingTender = await prisma.tender.findFirst({
        where: {
          seapId: tenderData.seapId,
          organizationId: org.id,
        },
      });

      if (existingTender) {
        results.push({ organizationId: org.id, action: 'skipped', reason: 'exists' });
        continue;
      }

      // Calculează scorul de potrivire
      const matchScore = calculateMatchScore(tenderData, org);

      // Creează tender-ul
      const tender = await prisma.tender.create({
        data: {
          seapId: tenderData.seapId,
          seapUrl: tenderData.seapUrl,
          title: tenderData.title,
          description: tenderData.description,
          contractingAuth: tenderData.contractingAuth,
          contractingAuthCui: tenderData.contractingAuthCui,
          estimatedValue: tenderData.estimatedValue
            ? new Decimal(tenderData.estimatedValue)
            : null,
          currency: tenderData.currency,
          cpvCode: tenderData.cpvCode,
          cpvCodes: [],
          cpvDescription: tenderData.cpvDescription,
          procedureType: tenderData.procedureType,
          contractType: tenderData.contractType,
          publicationDate: tenderData.publicationDate
            ? new Date(tenderData.publicationDate)
            : null,
          submissionDeadline: tenderData.submissionDeadline
            ? new Date(tenderData.submissionDeadline)
            : null,
          status: 'NEW',
          matchScore,
          organizationId: org.id,
        },
      });

      // Creează eveniment "PUBLISHED"
      await prisma.tenderEvent.create({
        data: {
          tenderId: tender.id,
          eventType: 'PUBLISHED',
          title: 'Licitație publicată',
          details: `Licitație ${tenderData.seapId} găsită pe SEAP`,
          seapDate: tenderData.publicationDate
            ? new Date(tenderData.publicationDate)
            : new Date(),
        },
      });

      // Dacă sunt documente atașate, descarcă-le
      if (tenderData.documents && tenderData.documents.length > 0) {
        await processDocumentsForTender(tender.id, org.id, tenderData.documents);
      }

      results.push({
        organizationId: org.id,
        action: 'created',
        tenderId: tender.id,
        matchScore,
      });
    }

    return { processed: true, results };
  } catch (error) {
    console.error('Error handling tender_found:', error);
    throw error;
  }
}

function calculateMatchScore(
  tender: z.infer<typeof tenderDataSchema>,
  org: { cpvCodes: string[]; keywords: string[]; minValue: unknown; maxValue: unknown }
): number {
  let score = 50; // Scor de bază

  // +20 dacă CPV-ul e în lista organizației
  if (org.cpvCodes?.includes(tender.cpvCode)) {
    score += 20;
  }

  // +10 pentru fiecare keyword găsit în titlu
  const title = tender.title.toLowerCase();
  org.keywords?.forEach((keyword) => {
    if (title.includes(keyword.toLowerCase())) {
      score += 10;
    }
  });

  // +10 dacă valoarea e în range
  if (tender.estimatedValue && org.minValue && org.maxValue) {
    const value = tender.estimatedValue;
    const min = Number(org.minValue);
    const max = Number(org.maxValue);
    if (value >= min && value <= max) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

async function handleDocumentsDownloaded(data: Record<string, unknown>, logId: string) {
  try {
    const parsed = documentsDataSchema.parse(data);

    // Găsește tender-ul
    const tender = await prisma.tender.findUnique({
      where: { id: parsed.tenderId },
      select: { id: true, organizationId: true },
    });

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

    const results = await processDocumentsForTender(
      tender.id,
      tender.organizationId,
      parsed.documents
    );

    return { processed: true, documents: results };
  } catch (error) {
    console.error('Error handling documents_downloaded:', error);
    throw error;
  }
}

async function processDocumentsForTender(
  tenderId: string,
  organizationId: string,
  documents: Array<{ url: string; filename?: string }>
) {
  const results = [];

  for (const doc of documents) {
    // Descarcă documentul
    const downloadResult = await downloadSeapDocument(
      doc.url,
      organizationId,
      tenderId,
      doc.filename
    );

    if (!downloadResult.success) {
      results.push({
        filename: doc.filename || doc.url,
        status: 'failed',
        error: (downloadResult as { error: string }).error,
      });
      continue;
    }

    const successResult = downloadResult as DownloadResult;

    // Detectează tipul documentului
    const docType = detectDocumentType(successResult.filename);

    // Creează înregistrarea în DB
    const tenderDocument = await prisma.tenderDocument.create({
      data: {
        tenderId,
        filename: successResult.filename,
        originalUrl: doc.url,
        storagePath: successResult.storagePath,
        fileSize: successResult.fileSize,
        mimeType: successResult.mimeType,
        hash: successResult.hash,
        docType,
        isProcessed: false,
      },
    });

    // Procesează OCR dacă e suportat
    if (isOcrSupported(successResult.mimeType)) {
      try {
        const fileBuffer = await getFile(successResult.storagePath);
        const ocrResult = await processDocumentOcr(
          fileBuffer,
          successResult.filename,
          successResult.mimeType
        );

        if ('text' in ocrResult && ocrResult.text) {
          await prisma.tenderDocument.update({
            where: { id: tenderDocument.id },
            data: {
              ocrText: ocrResult.text,
              isProcessed: true,
            },
          });
        }
      } catch (ocrError) {
        console.error('OCR processing error:', ocrError);
        // Continue without OCR - don't fail the whole process
      }
    }

    results.push({
      filename: successResult.filename,
      status: 'success',
      documentId: tenderDocument.id,
      ocr: successResult.mimeType ? isOcrSupported(successResult.mimeType) : false,
    });
  }

  return results;
}

async function handleAnalysisComplete(data: Record<string, unknown>, logId: string) {
  try {
    const parsed = analysisDataSchema.parse(data);

    // Verifică că tender-ul există
    const tender = await prisma.tender.findUnique({
      where: { id: parsed.tenderId },
    });

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

    // Salvează sau actualizează analiza
    const analysis = await prisma.tenderAnalysis.upsert({
      where: { tenderId: parsed.tenderId },
      update: {
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        opportunities: parsed.opportunities || [],
        threats: parsed.threats || [],
        recommendation: parsed.recommendation || 'CAUTION',
        aiSummary: parsed.aiSummary,
        confidence: parsed.confidence,
        modelUsed: 'n8n-external',
        analyzedAt: new Date(),
      },
      create: {
        tenderId: parsed.tenderId,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        opportunities: parsed.opportunities || [],
        threats: parsed.threats || [],
        recommendation: parsed.recommendation || 'CAUTION',
        aiSummary: parsed.aiSummary,
        confidence: parsed.confidence,
        modelUsed: 'n8n-external',
      },
    });

    // Actualizează statusul tender-ului
    await prisma.tender.update({
      where: { id: parsed.tenderId },
      data: { status: 'REVIEWING' },
    });

    return { processed: true, analysisId: analysis.id };
  } catch (error) {
    console.error('Error handling analysis_complete:', error);
    throw error;
  }
}

async function handleClarificationPublished(data: Record<string, unknown>, logId: string) {
  try {
    const parsed = clarificationDataSchema.parse(data);

    // Găsește tender-ul (după tenderId sau seapId)
    let tender;
    if (parsed.tenderId) {
      tender = await prisma.tender.findUnique({
        where: { id: parsed.tenderId },
        select: { id: true, organizationId: true },
      });
    } else if (parsed.seapId) {
      tender = await prisma.tender.findFirst({
        where: { seapId: parsed.seapId },
        select: { id: true, organizationId: true },
      });
    }

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

    // Creează eveniment de clarificare
    const event = await prisma.tenderEvent.create({
      data: {
        tenderId: tender.id,
        eventType: 'CLARIFICATION',
        title: parsed.title,
        details: parsed.content,
        seapDate: parsed.publishedAt ? new Date(parsed.publishedAt) : new Date(),
      },
    });

    // Dacă există un document atașat, descarcă-l
    if (parsed.documentUrl) {
      await processDocumentsForTender(tender.id, tender.organizationId, [
        { url: parsed.documentUrl, filename: `clarificare_${Date.now()}.pdf` },
      ]);
    }

    return { processed: true, eventId: event.id };
  } catch (error) {
    console.error('Error handling clarification_published:', error);
    throw error;
  }
}

async function handleDeadlineApproaching(data: Record<string, unknown>, logId: string) {
  try {
    const parsed = deadlineDataSchema.parse(data);

    // Găsește tender-ul
    let tender;
    if (parsed.tenderId) {
      tender = await prisma.tender.findUnique({
        where: { id: parsed.tenderId },
        include: { organization: { include: { users: true } } },
      });
    } else if (parsed.seapId) {
      tender = await prisma.tender.findFirst({
        where: { seapId: parsed.seapId },
        include: { organization: { include: { users: true } } },
      });
    }

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

    // Log the deadline approaching (notifications to be implemented)
    console.log(
      `Deadline approaching for tender ${tender.id}: ${parsed.daysRemaining} days remaining`
    );

    // Creează eveniment
    await prisma.tenderEvent.create({
      data: {
        tenderId: tender.id,
        eventType: 'OTHER',
        title: `Deadline în ${parsed.daysRemaining} zile`,
        details: `Termenul limită de depunere este ${new Date(parsed.deadline).toLocaleDateString('ro-RO')}`,
        seapDate: new Date(),
      },
    });

    // TODO: Send email notifications to organization users
    // for (const user of tender.organization.users) {
    //   await sendDeadlineNotification(user.email, tender, parsed.daysRemaining);
    // }

    return {
      processed: true,
      tenderId: tender.id,
      daysRemaining: parsed.daysRemaining,
      notificationsQueued: tender.organization.users.length,
    };
  } catch (error) {
    console.error('Error handling deadline_approaching:', error);
    throw error;
  }
}

async function handleTenderUpdated(data: Record<string, unknown>, logId: string) {
  try {
    const parsed = tenderUpdateDataSchema.parse(data);

    // Găsește tender-ul
    let tender;
    if (parsed.tenderId) {
      tender = await prisma.tender.findUnique({
        where: { id: parsed.tenderId },
      });
    } else {
      tender = await prisma.tender.findFirst({
        where: { seapId: parsed.seapId },
      });
    }

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

    // Determină tipul de modificare
    let eventType: 'MODIFICATION' | 'DEADLINE_CHANGE' = 'MODIFICATION';
    const changeDetails: string[] = [];

    for (const [key, value] of Object.entries(parsed.changes)) {
      if (key === 'submissionDeadline') {
        eventType = 'DEADLINE_CHANGE';
        changeDetails.push(
          `Termen nou: ${new Date(value as string).toLocaleDateString('ro-RO')}`
        );
      } else {
        changeDetails.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    // Creează eveniment de modificare
    const event = await prisma.tenderEvent.create({
      data: {
        tenderId: tender.id,
        eventType,
        title: eventType === 'DEADLINE_CHANGE' ? 'Modificare termen' : 'Documentație modificată',
        details: changeDetails.join('\n'),
        seapDate: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
      },
    });

    // Actualizează tender-ul cu noile valori (dacă sunt valide)
    const updateData: Record<string, unknown> = {};

    if (parsed.changes.submissionDeadline) {
      updateData.submissionDeadline = new Date(parsed.changes.submissionDeadline as string);
    }
    if (parsed.changes.estimatedValue !== undefined) {
      updateData.estimatedValue = new Decimal(parsed.changes.estimatedValue as number);
    }
    if (parsed.changes.title) {
      updateData.title = parsed.changes.title;
    }
    if (parsed.changes.description) {
      updateData.description = parsed.changes.description;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.tender.update({
        where: { id: tender.id },
        data: updateData,
      });
    }

    return {
      processed: true,
      tenderId: tender.id,
      eventId: event.id,
      changes: Object.keys(parsed.changes),
    };
  } catch (error) {
    console.error('Error handling tender_updated:', error);
    throw error;
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'seap-assistant-webhook',
    timestamp: new Date().toISOString(),
  });
}
