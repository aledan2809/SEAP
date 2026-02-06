import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage client pentru Cloudflare R2 / MinIO
 * S3-compatible API
 */

const isProduction = process.env.NODE_ENV === 'production';

// Cloudflare R2 pentru production, MinIO pentru development/on-premise
const storageConfig = {
  endpoint: process.env.R2_ENDPOINT || 'http://localhost:9000',
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.R2_SECRET_KEY || 'minioadmin',
  },
};

export const storageClient = new S3Client(storageConfig);

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'seap-documents';

/**
 * Upload fișier în storage
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await storageClient.send(command);

  return {
    key,
    url: `${storageConfig.endpoint}/${BUCKET_NAME}/${key}`,
  };
}

/**
 * Upload document licitație
 */
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

/**
 * Upload document firmă
 */
export async function uploadCompanyDocument(
  organizationId: string,
  filename: string,
  body: Buffer,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const key = `${organizationId}/company/${filename}`;
  return uploadFile(key, body, contentType);
}

/**
 * Obține fișier din storage
 */
export async function getFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await storageClient.send(command);
  const bodyContents = await response.Body?.transformToByteArray();

  if (!bodyContents) {
    throw new Error(`File not found: ${key}`);
  }

  return Buffer.from(bodyContents);
}

/**
 * Generează URL semnat pentru download (valabil 1 oră)
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(storageClient, command, { expiresIn });
}

/**
 * Șterge fișier din storage
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await storageClient.send(command);
}

/**
 * Listează fișiere dintr-un folder
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await storageClient.send(command);
  return response.Contents?.map((item) => item.Key || '') || [];
}

/**
 * Listează documentele unei licitații
 */
export async function listTenderDocuments(
  organizationId: string,
  tenderId: string
): Promise<string[]> {
  const prefix = `${organizationId}/tenders/${tenderId}/documents/`;
  return listFiles(prefix);
}
