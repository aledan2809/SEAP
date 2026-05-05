import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadCompanyDocument } from '@/lib/storage';
import { logAction, AuditActions } from '@/lib/audit-log';
import { CompanyDocType, Prisma } from '@prisma/client';
import { z } from 'zod';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const metaSchema = z.object({
  name: z.string().min(1).max(255),
  docType: z.nativeEnum(CompanyDocType),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// GET — list company documents for this org
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id, organizationId: id },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await prisma.companyDocument.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — upload a company document (multipart/form-data)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only OWNER or ADMIN may upload
    const membership = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Fișierul lipsește' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fișierul depășește limita de ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    const contentType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES[contentType]) {
      return NextResponse.json(
        { error: 'Tip de fișier nepermis. Acceptat: PDF, JPG, PNG, DOCX, XLSX.' },
        { status: 415 }
      );
    }

    const rawMeta = {
      name: formData.get('name') ?? file.name,
      docType: formData.get('docType'),
      issuedAt: formData.get('issuedAt') ?? undefined,
      expiresAt: formData.get('expiresAt') ?? undefined,
      metadata: formData.get('metadata')
        ? JSON.parse(formData.get('metadata') as string)
        : undefined,
    };

    const parsed = metaSchema.safeParse(rawMeta);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Date invalide', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, docType, issuedAt, expiresAt, metadata } = parsed.data;

    const ext = ALLOWED_TYPES[contentType];
    const safeFilename = `${docType.toLowerCase()}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { key } = await uploadCompanyDocument(id, safeFilename, buffer, contentType);

    const doc = await prisma.companyDocument.create({
      data: {
        organizationId: id,
        name,
        docType,
        storagePath: key,
        fileSize: file.size,
        issuedAt: issuedAt ? new Date(issuedAt) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: AuditActions.DOC_UPLOAD,
      resource: 'company_document',
      resourceId: doc.id,
      details: { organizationId: id, docType, name, fileSize: file.size },
      request,
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscută';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
