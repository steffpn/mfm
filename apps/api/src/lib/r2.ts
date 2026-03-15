/**
 * Cloudflare R2 client -- upload helper and presigned URL generator.
 *
 * Uses the S3-compatible API via @aws-sdk/client-s3. Configured with
 * R2-specific endpoint and credentials from environment variables.
 *
 * When SNIPPETS_ENABLED is not 'true', exports stub functions that throw
 * clear errors if called (lazy validation -- avoids crashing at import time
 * when snippets are disabled).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const snippetsEnabled = process.env.SNIPPETS_ENABLED === "true";

function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set when SNIPPETS_ENABLED=true",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error(
      "R2_BUCKET_NAME must be set when SNIPPETS_ENABLED=true",
    );
  }
  return bucket;
}

// Initialize eagerly when snippets are enabled
export const r2Client: S3Client | null = snippetsEnabled
  ? createR2Client()
  : null;

/**
 * Upload a file to R2.
 *
 * @param key - R2 object key (e.g., snippets/1/2026-03-15/42.aac)
 * @param body - File contents as Buffer
 * @param contentType - MIME type (defaults to audio/aac)
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string = "audio/aac",
): Promise<void> {
  if (!r2Client) {
    throw new Error(
      "R2 client not initialized. Set SNIPPETS_ENABLED=true with valid R2 credentials.",
    );
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Generate a presigned URL for downloading an object from R2.
 *
 * @param key - R2 object key
 * @param expiresInSeconds - URL expiry in seconds (default: 86400 = 24 hours)
 * @returns Presigned URL string
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = 86400,
): Promise<string> {
  if (!r2Client) {
    throw new Error(
      "R2 client not initialized. Set SNIPPETS_ENABLED=true with valid R2 credentials.",
    );
  }

  return getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
