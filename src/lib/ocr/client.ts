/**
 * Client pentru serviciul OCR extern (C:\Projects\ocr-model)
 * API: http://localhost:8000
 */

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

interface OcrSession {
  session_id: string;
}

interface OcrResult {
  text: string;
  confidence?: number;
  pages?: number;
}

interface OcrError {
  success: false;
  error: string;
}

/**
 * Procesează un document prin serviciul OCR
 * Flow: create session -> upload -> process -> get results -> cleanup
 */
export async function processDocumentOcr(
  fileBuffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<OcrResult | OcrError> {
  let sessionId: string | null = null;

  try {
    // Step 1: Create session
    const sessionResponse = await fetch(`${OCR_SERVICE_URL}/api/session/create`, {
      method: 'POST',
    });

    if (!sessionResponse.ok) {
      return {
        success: false,
        error: `Failed to create OCR session: ${sessionResponse.status}`,
      };
    }

    const session: OcrSession = await sessionResponse.json();
    sessionId = session.session_id;

    // Step 2: Upload file
    const formData = new FormData();
    // Convert Buffer to ArrayBuffer for Blob compatibility
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType || 'application/pdf' });
    formData.append('files', blob, filename);

    const uploadResponse = await fetch(
      `${OCR_SERVICE_URL}/api/upload?session_id=${sessionId}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: `Failed to upload file for OCR: ${uploadResponse.status}`,
      };
    }

    // Step 3: Process OCR
    const processResponse = await fetch(`${OCR_SERVICE_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        anonymize: false,
      }),
    });

    if (!processResponse.ok) {
      return {
        success: false,
        error: `Failed to process OCR: ${processResponse.status}`,
      };
    }

    // Step 4: Get results
    const resultsResponse = await fetch(
      `${OCR_SERVICE_URL}/api/results/${sessionId}`
    );

    if (!resultsResponse.ok) {
      return {
        success: false,
        error: `Failed to get OCR results: ${resultsResponse.status}`,
      };
    }

    const results = await resultsResponse.json();

    // Extract text from results
    // The OCR service returns results in format: { results: [...] }
    let extractedText = '';
    let totalPages = 0;

    if (results.results && Array.isArray(results.results)) {
      for (const result of results.results) {
        if (result.text) {
          extractedText += result.text + '\n\n';
        }
        if (result.pages) {
          totalPages += result.pages;
        }
      }
    } else if (typeof results.text === 'string') {
      extractedText = results.text;
    }

    return {
      text: extractedText.trim(),
      pages: totalPages || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Cleanup: delete session
    if (sessionId) {
      try {
        await fetch(`${OCR_SERVICE_URL}/api/session/${sessionId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Verifică dacă serviciul OCR este disponibil
 */
export async function checkOcrServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Determină dacă un fișier poate fi procesat prin OCR
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
