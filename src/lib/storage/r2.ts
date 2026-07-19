import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env.server";

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const emailAttachmentTypes = new Set([
  ...imageTypes,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const supportImageMaxBytes = 25 * 1024 * 1024;
export const emailAttachmentMaxBytes = 25 * 1024 * 1024;
export const attachmentRetentionDays = 90;
export const parcelAiImageMaxBytes = 10 * 1024 * 1024;
export const parcelAiImageRetentionHours = 24;

let r2Client: S3Client | null = null;

function getR2Config() {
  const endpoint =
    serverEnv.CLOUDFLARE_R2_ENDPOINT ||
    (serverEnv.CLOUDFLARE_R2_ACCOUNT_ID
      ? `https://${serverEnv.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : "");
  const missing = [
    ["CLOUDFLARE_R2_ENDPOINT", endpoint],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY],
    ["CLOUDFLARE_R2_BUCKET", serverEnv.CLOUDFLARE_R2_BUCKET],
  ].filter(([, value]) => !value);

  if (missing.length) {
    throw new Error(`r2_not_configured:${missing.map(([key]) => key).join(",")}`);
  }

  return {
    endpoint,
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET,
    accessKeyId: serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  };
}

function getR2Client() {
  if (r2Client) return r2Client;
  const config = getR2Config();
  r2Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return r2Client;
}

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(-96);
  return normalized || "attachment";
}

export function isSupportImage(contentType: string, sizeBytes: number) {
  return imageTypes.has(contentType) && sizeBytes > 0 && sizeBytes <= supportImageMaxBytes;
}

export function isParcelAiImage(contentType: string, sizeBytes: number) {
  return imageTypes.has(contentType) && sizeBytes > 0 && sizeBytes <= parcelAiImageMaxBytes;
}

export function isAcceptedEmailAttachment(contentType: string, sizeBytes: number) {
  return (
    emailAttachmentTypes.has(contentType) &&
    sizeBytes > 0 &&
    sizeBytes <= emailAttachmentMaxBytes
  );
}

export function createR2ObjectKey(scope: "support" | "evaluation" | "email", ownerId: string, fileName: string) {
  return `${scope}/${ownerId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

export function createParcelAiR2ObjectKey(
  draftId: string,
  ownerId: string,
  fileName: string,
  variant: "original" | "normalized" = "original",
) {
  return `parcel-ai/${ownerId}/${draftId}/${variant}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

export async function createR2UploadUrl(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  retentionHours?: number;
}) {
  const config = getR2Config();
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      Metadata: { expires: String(Date.now() + (input.retentionHours ?? attachmentRetentionDays * 24) * 3600000) },
    }),
    { expiresIn: 600 },
  );
}

export async function getR2Object(input: { objectKey: string; maxBytes?: number }) {
  const config = getR2Config();
  const response = await getR2Client().send(
    new GetObjectCommand({ Bucket: config.bucket, Key: input.objectKey }),
  );
  const contentLength = Number(response.ContentLength ?? 0);
  if (input.maxBytes && contentLength > input.maxBytes) {
    throw new Error("object_too_large");
  }
  if (!response.Body) throw new Error("object_missing_body");
  const bytes = await response.Body.transformToByteArray();
  return { bytes, contentType: response.ContentType ?? "application/octet-stream" };
}

export async function r2ObjectExists(objectKey: string) {
  const config = getR2Config();
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}

export async function createR2DownloadUrl(objectKey: string) {
  const config = getR2Config();
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: 300 },
  );
}

export async function uploadR2Object(input: {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  retentionHours?: number;
}) {
  const config = getR2Config();
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.body.byteLength,
      Metadata: { expires: String(Date.now() + (input.retentionHours ?? attachmentRetentionDays * 24) * 3600000) },
    }),
  );
}

export async function deleteR2Objects(objectKeys: string[]) {
  const uniqueKeys = [...new Set(objectKeys.filter(Boolean))].slice(0, 1_000);
  if (!uniqueKeys.length) return [];

  const config = getR2Config();
  const result = await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: uniqueKeys.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
  const failedKeys = new Set((result.Errors ?? []).flatMap((error) => error.Key ? [error.Key] : []));
  return uniqueKeys.filter((key) => !failedKeys.has(key));
}
