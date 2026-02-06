import { createHash } from 'crypto';
import { uploadTenderDocument } from '@/lib/storage';

interface DownloadResult {
  success: boolean;
  filename: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  hash: string;
}

interface DownloadError {
  success: false;
  filename: string;
  error: string;
}

/**
 * Descarcă un document de pe SEAP și îl salvează în R2/MinIO
 */
export async function downloadSeapDocument(
  url: string,
  organizationId: string,
  tenderId: string,
  filename?: string
): Promise<DownloadResult | DownloadError> {
  try {
    // Fetch document from SEAP
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*,*/*',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        filename: filename || 'unknown',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Get filename from Content-Disposition header or URL
    const contentDisposition = response.headers.get('content-disposition');
    let finalFilename = filename || extractFilenameFromUrl(url);

    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        finalFilename = match[1].replace(/['"]/g, '');
      }
    }

    // Get content type
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';

    // Download as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash for change detection
    const hash = createHash('sha256').update(buffer).digest('hex');

    // Upload to storage
    const { key } = await uploadTenderDocument(
      organizationId,
      tenderId,
      finalFilename,
      buffer,
      mimeType
    );

    return {
      success: true,
      filename: finalFilename,
      storagePath: key,
      fileSize: buffer.length,
      mimeType,
      hash,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      filename: filename || 'unknown',
      error: errorMessage,
    };
  }
}

/**
 * Descarcă toate documentele unei licitații din SEAP
 */
export async function downloadTenderDocuments(
  documents: Array<{ url: string; filename?: string }>,
  organizationId: string,
  tenderId: string
): Promise<Array<DownloadResult | DownloadError>> {
  const results: Array<DownloadResult | DownloadError> = [];

  for (const doc of documents) {
    const result = await downloadSeapDocument(
      doc.url,
      organizationId,
      tenderId,
      doc.filename
    );
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Extrage numele fișierului din URL
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'document';

    // Decode URL-encoded characters
    return decodeURIComponent(filename);
  } catch {
    return 'document';
  }
}

/**
 * Determină tipul documentului bazat pe nume
 */
export function detectDocumentType(
  filename: string
): 'CAIET_SARCINI' | 'FISA_DATE' | 'FORMULARE' | 'CONTRACT_MODEL' | 'CLARIFICARE' | 'DOCUMENTATIE' | 'ANEXE' | 'OTHER' {
  const lowerName = filename.toLowerCase();

  if (lowerName.includes('caiet') || lowerName.includes('specificat') || lowerName.includes('tehnic')) {
    return 'CAIET_SARCINI';
  }
  if (lowerName.includes('fisa') || lowerName.includes('date')) {
    return 'FISA_DATE';
  }
  if (lowerName.includes('formular')) {
    return 'FORMULARE';
  }
  if (lowerName.includes('contract') || lowerName.includes('model')) {
    return 'CONTRACT_MODEL';
  }
  if (lowerName.includes('clarificar') || lowerName.includes('raspuns') || lowerName.includes('intrebare')) {
    return 'CLARIFICARE';
  }
  if (lowerName.includes('documentatie') || lowerName.includes('atribuire')) {
    return 'DOCUMENTATIE';
  }
  if (lowerName.includes('anexa') || lowerName.includes('anexe')) {
    return 'ANEXE';
  }

  return 'OTHER';
}

export type { DownloadResult, DownloadError };
