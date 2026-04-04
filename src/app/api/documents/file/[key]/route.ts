import { NextRequest, NextResponse } from 'next/server';
import { getFile } from '@/lib/storage';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import path from 'path';

// MIME types pentru fișiere comune
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.api);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    // Verifică autentificarea
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key } = await params;
    const decodedKey = decodeURIComponent(key);

    // Security: reject null bytes before any processing
    if (decodedKey.includes('\0')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Normalize the path first to collapse any Unicode or encoding tricks
    const normalizedKey = path.normalize(decodedKey).replace(/\\/g, '/');

    // Security: prevent path traversal — strict allowlist + resolve check
    // Block: .., backslash, double slash, null byte, leading slash, non-allowlist chars
    if (
      normalizedKey.includes('..') ||
      normalizedKey.includes('\\') ||
      normalizedKey.includes('//') ||
      normalizedKey.includes('\0') ||
      normalizedKey.startsWith('/') ||
      normalizedKey.startsWith('.') ||
      !/^[a-zA-Z0-9._\-/]+$/.test(normalizedKey)
    ) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Reject keys with more than 5 path segments (org/tenders/id/documents/file)
    if (normalizedKey.split('/').length > 6) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Double-check: resolved path must stay within the storage root
    const storageRoot = path.resolve(process.env.STORAGE_PATH || './storage/documents');
    const resolvedPath = path.resolve(storageRoot, normalizedKey);
    // Normalize separators for consistent comparison on Windows
    const normalizedStorageRoot = storageRoot.replace(/\\/g, '/');
    const normalizedResolvedPath = resolvedPath.replace(/\\/g, '/');
    if (
      normalizedResolvedPath !== normalizedStorageRoot &&
      !normalizedResolvedPath.startsWith(normalizedStorageRoot + '/')
    ) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Verify org-scoped access: storage keys follow {organizationId}/...
    const orgId = normalizedKey.split('/')[0];
    if (orgId) {
      const userOrg = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: orgId,
          },
        },
      });
      if (!userOrg) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Obține fișierul
    const fileBuffer = await getFile(normalizedKey);
    const filename = path.basename(normalizedKey);
    const contentType = getMimeType(filename);

    // Sanitize filename for Content-Disposition to prevent header injection
    // Remove any characters that could break the header or inject new headers
    const sanitizedFilename = filename
      .replace(/[^\w.\-]/g, '_')  // Only allow word chars, dots, hyphens
      .replace(/\.{2,}/g, '.');    // Collapse multiple dots

    // Convert Buffer to Uint8Array pentru compatibilitate
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
