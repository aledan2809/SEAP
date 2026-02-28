/**
 * OCR Client — built-in PDF text extraction + optional external OCR service
 *
 * Strategy:
 * 1. PDFs → pdf-parse (built-in, no external dependency)
 * 2. Images/Word/Excel → external OCR service if available, skip otherwise
 */

import { PDFParse } from 'pdf-parse';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

interface OcrResult {
  text: string;
  confidence?: number;
  pages?: number;
}

interface OcrError {
  success: false;
  error: string;
}

// ── Built-in PDF extraction ──

async function extractPdfText(fileBuffer: Buffer): Promise<OcrResult> {
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
  try {
    const textResult = await parser.getText();
    return {
      text: textResult.text.trim(),
      pages: textResult.total,
      confidence: textResult.text.length > 100 ? 0.9 : 0.5,
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// ── External OCR (for images and other formats) ──

async function processWithExternalOcr(
  fileBuffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<OcrResult | OcrError> {
  let sessionId: string | null = null;

  try {
    // Create session
    const sessionRes = await fetch(`${OCR_SERVICE_URL}/api/session/create`, { method: 'POST' });
    if (!sessionRes.ok) {
      return { success: false, error: `OCR session create failed: ${sessionRes.status}` };
    }
    const session = await sessionRes.json();
    sessionId = session.session_id;

    // Upload
    const formData = new FormData();
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType || 'application/octet-stream' });
    formData.append('files', blob, filename);

    const uploadRes = await fetch(`${OCR_SERVICE_URL}/api/upload?session_id=${sessionId}`, {
      method: 'POST',
      body: formData,
    });
    if (!uploadRes.ok) {
      return { success: false, error: `OCR upload failed: ${uploadRes.status}` };
    }

    // Process
    const processRes = await fetch(`${OCR_SERVICE_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, anonymize: false }),
    });
    if (!processRes.ok) {
      return { success: false, error: `OCR process failed: ${processRes.status}` };
    }

    // Results
    const resultsRes = await fetch(`${OCR_SERVICE_URL}/api/results/${sessionId}`);
    if (!resultsRes.ok) {
      return { success: false, error: `OCR results failed: ${resultsRes.status}` };
    }

    const results = await resultsRes.json();
    let extractedText = '';
    let totalPages = 0;

    if (results.results && Array.isArray(results.results)) {
      for (const result of results.results) {
        if (result.text) extractedText += result.text + '\n\n';
        if (result.pages) totalPages += result.pages;
      }
    } else if (typeof results.text === 'string') {
      extractedText = results.text;
    }

    return { text: extractedText.trim(), pages: totalPages || undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'External OCR error' };
  } finally {
    if (sessionId) {
      try {
        await fetch(`${OCR_SERVICE_URL}/api/session/${sessionId}`, { method: 'DELETE' });
      } catch {
        // ignore cleanup
      }
    }
  }
}

// ── Public API ──

/**
 * Process a document — auto-selects best extraction method
 */
export async function processDocumentOcr(
  fileBuffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<OcrResult | OcrError> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || mimeType === 'application/pdf';

  // PDFs: use built-in pdf-parse (fast, no external dependency)
  if (isPdf) {
    try {
      return await extractPdfText(fileBuffer);
    } catch (error) {
      // If pdf-parse fails (scanned PDF), try external OCR
      const ocrAvailable = await checkOcrServiceHealth();
      if (ocrAvailable) {
        return processWithExternalOcr(fileBuffer, filename, mimeType);
      }
      return {
        success: false,
        error: `PDF text extraction failed (scanned PDF?) and external OCR not available: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }
  }

  // Images & other formats: use external OCR if available
  const ocrAvailable = await checkOcrServiceHealth();
  if (ocrAvailable) {
    return processWithExternalOcr(fileBuffer, filename, mimeType);
  }

  return {
    success: false,
    error: `No OCR available for ${ext} files. External OCR service not running.`,
  };
}

/**
 * Check if external OCR service is running
 */
export async function checkOcrServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a file can be processed
 */
export function isOcrSupported(mimeType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/bmp',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  return supportedTypes.includes(mimeType);
}

export type { OcrResult, OcrError };
