import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

/**
 * Storage client — Cloudflare R2 when configured, local filesystem fallback
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'seap-documents';
const R2_ENDPOINT = process.env.R2_ENDPOINT;

const STORAGE_ROOT = process.env.STORAGE_PATH || './storage/documents';

const useR2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY!,
        secretAccessKey: R2_SECRET_KEY!,
      },
    });
  }
  return s3Client;
}

// ── Local filesystem helpers ──

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // exists
  }
}

function getFullPath(key: string): string {
  return path.join(STORAGE_ROOT, key);
}

// ── Public API ──

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  if (useR2) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: typeof body === 'string' ? Buffer.from(body) : body,
        ContentType: contentType || 'application/octet-stream',
      })
    );
    return { key, url: `/api/documents/file/${encodeURIComponent(key)}` };
  }

  // Local fallback
  const fullPath = getFullPath(key);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, body);
  return { key, url: `/api/documents/file/${encodeURIComponent(key)}` };
}

export async function uploadTenderDocument(
  organizationId: string,
  tenderId: string,
  filename: string,
  body: Buffer,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const key = `${organizationId}/tenders/${tenderId}/documents/${filename}`;
  return uploadFile(key, body, contentType);
}

export async function uploadCompanyDocument(
  organizationId: string,
  filename: string,
  body: Buffer,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const key = `${organizationId}/company/${filename}`;
  return uploadFile(key, body, contentType);
}

export async function getFile(key: string): Promise<Buffer> {
  if (useR2) {
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    if (!res.Body) throw new Error(`File not found: ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const fullPath = getFullPath(key);
  try {
    return await fs.readFile(fullPath);
  } catch {
    throw new Error(`File not found: ${key}`);
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  if (useR2) {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      { expiresIn }
    );
    return url;
  }

  // Local — verify file exists, return internal API path
  const fullPath = getFullPath(key);
  await fs.access(fullPath);
  return `/api/documents/file/${encodeURIComponent(key)}`;
}

export async function deleteFile(key: string): Promise<void> {
  if (useR2) {
    await getS3().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    return;
  }

  try {
    await fs.unlink(getFullPath(key));
  } catch {
    // ignore
  }
}

export async function listFiles(prefix: string): Promise<string[]> {
  if (useR2) {
    const res = await getS3().send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix })
    );
    return (res.Contents || []).map((obj) => obj.Key!).filter(Boolean);
  }

  const fullPath = getFullPath(prefix);
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true, recursive: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(prefix, entry.name).replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

export async function listTenderDocuments(
  organizationId: string,
  tenderId: string
): Promise<string[]> {
  return listFiles(`${organizationId}/tenders/${tenderId}/documents/`);
}

export async function checkStorageHealth(): Promise<{ ok: boolean; type: string; path: string }> {
  if (useR2) {
    try {
      await getS3().send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET, MaxKeys: 1 })
      );
      return { ok: true, type: 'r2', path: `r2://${R2_BUCKET}` };
    } catch {
      return { ok: false, type: 'r2', path: `r2://${R2_BUCKET}` };
    }
  }

  try {
    await ensureDir(STORAGE_ROOT);
    return { ok: true, type: 'local', path: STORAGE_ROOT };
  } catch {
    return { ok: false, type: 'local', path: STORAGE_ROOT };
  }
}
