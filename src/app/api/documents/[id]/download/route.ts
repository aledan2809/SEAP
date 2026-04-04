import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSignedDownloadUrl } from '@/lib/storage';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/documents/[id]/download
 * Returnează un URL semnat pentru descărcare document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.api);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verifică dacă e document licitație sau document firmă
    // Încearcă mai întâi TenderDocument
    let document = await prisma.tenderDocument.findFirst({
      where: {
        id,
        tender: {
          organization: {
            userOrganizations: {
              some: { userId: session.user.id },
            },
          },
        },
      },
      select: {
        id: true,
        filename: true,
        storagePath: true,
        mimeType: true,
      },
    });

    // Dacă nu e TenderDocument, încearcă CompanyDocument
    if (!document) {
      const companyDoc = await prisma.companyDocument.findFirst({
        where: {
          id,
          organization: {
            userOrganizations: {
              some: { userId: session.user.id },
            },
          },
        },
        select: {
          id: true,
          name: true,
          storagePath: true,
        },
      });

      if (companyDoc) {
        document = {
          id: companyDoc.id,
          filename: companyDoc.name,
          storagePath: companyDoc.storagePath,
          mimeType: null,
        };
      }
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Generează URL semnat (valabil 1 oră)
    const signedUrl = await getSignedDownloadUrl(document.storagePath, 3600);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      filename: document.filename,
      mimeType: document.mimeType,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Download URL error:', error);
    return NextResponse.json(
      { error: 'Eroare la generarea link-ului de descărcare' },
      { status: 500 }
    );
  }
}
