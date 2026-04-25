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
import { sendDeadlineAlertForTender, sendOpportunityReports } from '@/lib/email/notifications';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * Webhook endpoint pentru n8n
 * Primește evenimente de la workflow-urile n8n
 *
 * == SUPPORTED EVENT TYPES ==
 *
 * 1. tender_found
 *    - Triggered when a new tender is discovered
 *    - Creates tender records for all matching organizations
 *    - Downloads attached documents
 *    - Sends opportunity report emails
 *
 * 2. documents_downloaded
 *    - Triggered when documents are downloaded externally
 *    - Processes documents: downloads to storage, runs OCR
 *
 * 3. analysis_complete
 *    - Triggered when AI analysis is done externally
 *    - Stores SWOT analysis and recommendation
 *
 * 4. clarification_published
 *    - Triggered when a clarification is published on SEAP
 *    - Creates tender event, downloads attached documents
 *
 * 5. deadline_approaching
 *    - Triggered to notify about upcoming deadlines
 *    - Sends deadline alert emails to organization users
 *
 * 6. tender_updated
 *    - Triggered when tender details change (deadline, value, etc.)
 *    - Updates tender record and creates modification event
 *
 * == AUTHENTICATION ==
 * - Primary: WEBHOOK_SECRET header (x-webhook-secret)
 * - Fallback: N8N_API_KEY header (x-api-key)
 * - If neither env var is set, webhook is open (not recommended)
 *
 * == RATE LIMITING ==
 * - 100 requests per minute per IP
 * - Returns 429 Too Many Requests when exceeded
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
  timestamp: z.string().min(1, 'Timestamp is required for replay attack prevention'),
});

const tenderDataSchema = z.object({
  seapId: z.string().max(100),
  title: z.string().max(1000),
  description: z.string().max(10000).optional().nullable(),
  contractingAuth: z.string().max(500),
  contractingAuthCui: z.string().max(50).optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  currency: z.string().max(10).optional().default('RON'),
  cpvCode: z.string().max(50).regex(/^\d{8}-\d$/, 'Invalid CPV code format'),
  cpvDescription: z.string().max(500).optional().nullable(),
  procedureType: z.string().max(200).optional().default('unknown'),
  contractType: z.string().max(200).optional().nullable(),
  publicationDate: z.string().max(50).optional().nullable(),
  submissionDeadline: z.string().max(50).optional().nullable(),
  seapUrl: z.string().max(2000),
  documents: z
    .array(
      z.object({
        url: z.string().max(2000),
        filename: z.string().max(500).optional(),
      })
    )
    .max(50)
    .optional(),
});

const documentsDataSchema = z.object({
  tenderId: z.string().max(100),
  documents: z.array(
    z.object({
      url: z.string().max(2000),
      filename: z.string().max(500).optional(),
    })
  ).max(50),
});

const analysisDataSchema = z.object({
  tenderId: z.string().max(100),
  strengths: z.array(z.string().max(1000)).max(20).optional(),
  weaknesses: z.array(z.string().max(1000)).max(20).optional(),
  opportunities: z.array(z.string().max(1000)).max(20).optional(),
  threats: z.array(z.string().max(1000)).max(20).optional(),
  recommendation: z.enum(['GO', 'CAUTION', 'NO_GO']).optional(),
  aiSummary: z.string().max(10000).optional(),
  confidence: z.number().optional(),
});

const clarificationDataSchema = z.object({
  tenderId: z.string().max(100),
  seapId: z.string().max(100).optional(),
  title: z.string().max(1000),
  content: z.string().max(10000).optional(),
  documentUrl: z.string().max(2000).optional(),
  publishedAt: z.string().max(50).optional(),
});

const deadlineDataSchema = z.object({
  tenderId: z.string().max(100),
  seapId: z.string().max(100).optional(),
  deadline: z.string().max(50),
  daysRemaining: z.number(),
});

// Only allow known tender fields to be updated via webhook
const ALLOWED_CHANGE_KEYS = new Set([
  'title', 'description', 'submissionDeadline', 'estimatedValue',
  'contractType', 'procedureType', 'cpvCode', 'status',
]);

const tenderUpdateDataSchema = z.object({
  tenderId: z.string().max(100).optional(),
  seapId: z.string().max(100),
  changes: z.record(z.string().max(100), z.unknown()).refine(
    (obj) => Object.keys(obj).every((k) => ALLOWED_CHANGE_KEYS.has(k)),
    { message: 'Changes contain disallowed keys' }
  ),
  updatedAt: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.webhook);
    if (!limit.allowed) {
      console.warn(`[N8N Webhook] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json(
        { error: 'Too many requests. Max 100 per minute.' },
        { status: 429 }
      );
    }

    // Authentication: check WEBHOOK_SECRET first, then N8N_API_KEY
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const n8nApiKey = process.env.N8N_API_KEY;
    const providedWebhookSecret = request.headers.get('x-webhook-secret');
    const providedApiKey = request.headers.get('x-api-key');

    // Require at least one auth method to be configured
    if (!webhookSecret && !n8nApiKey) {
      console.error('[N8N Webhook] No authentication configured. Set WEBHOOK_SECRET or N8N_API_KEY.');
      return NextResponse.json({ error: 'Webhook authentication not configured' }, { status: 503 });
    }

    // Validate WEBHOOK_SECRET if set
    if (webhookSecret) {
      if (providedWebhookSecret !== webhookSecret) {
        console.warn(`[N8N Webhook] Invalid webhook secret from IP: ${clientIp}`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    // Otherwise validate N8N_API_KEY
    else if (n8nApiKey) {
      if (providedApiKey !== n8nApiKey) {
        console.warn(`[N8N Webhook] Invalid API key from IP: ${clientIp}`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Enforce max body size (1MB) to prevent oversized payloads
    const contentLength = request.headers.get('content-length');
    const MAX_BODY_SIZE = 1_048_576; // 1MB
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large. Max 1MB.' },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { event, data, timestamp } = webhookSchema.parse(body);

    // Replay attack prevention: reject events older than 2 minutes
    {
      const eventTime = new Date(timestamp).getTime();
      const now = Date.now();
      const MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes
      if (isNaN(eventTime) || Math.abs(now - eventTime) > MAX_AGE_MS) {
        console.warn(`[N8N Webhook] Rejected stale/invalid timestamp: ${timestamp} from IP: ${clientIp}`);
        return NextResponse.json(
          { error: 'Event timestamp too old or invalid. Max age: 2 minutes.' },
          { status: 400 }
        );
      }
    }

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
    try {
      switch (event) {
        case 'tender_found':
          result = await handleTenderFound(data);
          break;
        case 'documents_downloaded':
          result = await handleDocumentsDownloaded(data);
          break;
        case 'analysis_complete':
          result = await handleAnalysisComplete(data);
          break;
        case 'clarification_published':
          result = await handleClarificationPublished(data);
          break;
        case 'deadline_approaching':
          result = await handleDeadlineApproaching(data);
          break;
        case 'tender_updated':
          result = await handleTenderUpdated(data);
          break;
      }

      // Actualizează log-ul
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 'processed' },
      });
    } catch (handlerError) {
      // Log failure to webhook_log so it doesn't stay as "received"
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 'failed' },
      }).catch((e) => console.error('Failed to update webhook log:', e));
      throw handlerError;
    }

    return NextResponse.json({ success: true, logId: log.id, result });
  } catch (error) {
    console.error('Webhook error:', error);

    if (error instanceof z.ZodError) {
      console.warn('[N8N Webhook] Validation error:', error.issues);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ==================== HANDLERS ====================

async function handleTenderFound(data: Record<string, unknown>) {
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

    // If no organizations match CPV codes, skip — don't assign to random org
    if (organizations.length === 0) {
      console.warn(`[N8N Webhook] No organization matches CPV code ${tenderData.cpvCode}. Tender ${tenderData.seapId} skipped.`);
      return { skipped: true, reason: 'no_matching_organizations', cpvCode: tenderData.cpvCode };
    }

    const results = [];
    const createdTenderIds: string[] = [];

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
      createdTenderIds.push(tender.id);
    }

    let reports = { sent: 0, reports: 0 };
    if (createdTenderIds.length > 0) {
      reports = await sendOpportunityReports(createdTenderIds);
    }

    return {
      processed: true,
      results,
      notifications: {
        opportunityReportsSent: reports.sent,
        reportsGenerated: reports.reports,
      },
    };
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

async function handleDocumentsDownloaded(data: Record<string, unknown>) {
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

async function handleAnalysisComplete(data: Record<string, unknown>) {
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

async function handleClarificationPublished(data: Record<string, unknown>) {
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

async function handleDeadlineApproaching(data: Record<string, unknown>) {
  try {
    const parsed = deadlineDataSchema.parse(data);

    // Găsește tender-ul
    let tender;
    if (parsed.tenderId) {
      tender = await prisma.tender.findUnique({
        where: { id: parsed.tenderId },
        include: { organization: true },
      });
    } else if (parsed.seapId) {
      tender = await prisma.tender.findFirst({
        where: { seapId: parsed.seapId },
        include: { organization: true },
      });
    }

    if (!tender) {
      return { processed: false, error: 'Tender not found' };
    }

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

    const notificationStats = await sendDeadlineAlertForTender(
      tender.id,
      parsed.daysRemaining
    );

    return {
      processed: true,
      tenderId: tender.id,
      daysRemaining: parsed.daysRemaining,
      notificationsSent: notificationStats.sent,
    };
  } catch (error) {
    console.error('Error handling deadline_approaching:', error);
    throw error;
  }
}

async function handleTenderUpdated(data: Record<string, unknown>) {
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
