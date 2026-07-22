import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import sharp from "sharp";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createParcelAiR2ObjectKey,
  createR2DownloadUrl,
  createR2UploadUrl,
  deleteR2Objects,
  getR2Object,
  isParcelAiImage,
  parcelAiImageMaxBytes,
  uploadR2Object,
} from "@/lib/storage/r2";
import type { SupportIdentity } from "@/lib/support/support-hub";
import type { ParcelAiImageInput } from "@/types/parcel-intelligence";

const db = () => createAdminSupabaseClient() as never as { from: (table: string) => any };

export type ParcelAiImageRecord = {
  id: string;
  slot: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  r2_original_key: string;
  r2_normalized_key: string | null;
  normalized_content_type: string | null;
  status: "uploaded" | "ready" | "failed";
  expires_at: string;
};

function ensureActive(image: ParcelAiImageRecord) {
  if (Date.parse(image.expires_at) <= Date.now()) throw new Error("image_expired");
}

async function ensureDraftOwner(identity: SupportIdentity, draftId: string) {
  const { data, error } = await db().from("delivery_drafts")
    .select("id").eq("id", draftId).eq("profile_id", identity.profileId).eq("status", "active").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("draft_not_found");
}

async function deleteRecord(image: ParcelAiImageRecord) {
  await deleteR2Objects([image.r2_original_key, image.r2_normalized_key ?? ""]);
  await db().from("parcel_ai_images").delete().eq("id", image.id);
}

export async function listParcelAiImages(identity: SupportIdentity, draftId: string) {
  await ensureDraftOwner(identity, draftId);
  const { data, error } = await db().from("parcel_ai_images")
    .select("id,slot,original_name,content_type,size_bytes,r2_original_key,r2_normalized_key,normalized_content_type,status,expires_at")
    .eq("delivery_draft_id", draftId).gt("expires_at", new Date().toISOString()).order("slot");
  if (error) throw new Error(error.message);
  return await Promise.all(((data ?? []) as ParcelAiImageRecord[]).map(async (image) => ({
    id: image.id,
    slot: image.slot,
    name: image.original_name,
    contentType: image.normalized_content_type ?? image.content_type,
    status: image.status,
    expiresAt: image.expires_at,
    previewUrl: await createR2DownloadUrl(image.r2_normalized_key ?? image.r2_original_key),
  })));
}

export async function createParcelAiImageUpload(identity: SupportIdentity, input: {
  draftId: string; slot: number; fileName: string; contentType: string; sizeBytes: number;
}) {
  await ensureDraftOwner(identity, input.draftId);
  if (!Number.isInteger(input.slot) || input.slot < 0 || input.slot > 1 || !isParcelAiImage(input.contentType, input.sizeBytes)) throw new Error("invalid_image");
  const { data: existing } = await db().from("parcel_ai_images")
    .select("id,slot,original_name,content_type,size_bytes,r2_original_key,r2_normalized_key,normalized_content_type,status,expires_at")
    .eq("delivery_draft_id", input.draftId).eq("slot", input.slot).maybeSingle();
  if (existing) await deleteRecord(existing as ParcelAiImageRecord);
  const objectKey = createParcelAiR2ObjectKey(input.draftId, identity.profileId, input.fileName);
  const { data, error } = await db().from("parcel_ai_images").insert({
    delivery_draft_id: input.draftId, uploaded_by_profile_id: identity.profileId, slot: input.slot,
    original_name: input.fileName, content_type: input.contentType, size_bytes: input.sizeBytes,
    r2_original_key: objectKey,
  }).select("id,expires_at").single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, objectKey, expiresAt: data.expires_at as string, uploadUrl: await createR2UploadUrl({ objectKey, contentType: input.contentType, sizeBytes: input.sizeBytes, retentionHours: 24 }) };
}

export async function removeParcelAiImage(identity: SupportIdentity, imageId: string) {
  const { data, error } = await db().from("parcel_ai_images")
    .select("id,slot,original_name,content_type,size_bytes,r2_original_key,r2_normalized_key,normalized_content_type,status,expires_at,delivery_drafts!inner(profile_id,status)")
    .eq("id", imageId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.delivery_drafts?.profile_id !== identity.profileId || data.delivery_drafts?.status !== "active") throw new Error("image_not_found");
  await deleteRecord(data as ParcelAiImageRecord);
}

export async function removeParcelAiImagesForDraft(
  identity: SupportIdentity,
  draftId: string,
) {
  await ensureDraftOwner(identity, draftId);
  const { data, error } = await db().from("parcel_ai_images")
    .select("id,slot,original_name,content_type,size_bytes,r2_original_key,r2_normalized_key,normalized_content_type,status,expires_at")
    .eq("delivery_draft_id", draftId);
  if (error) throw new Error(error.message);

  await Promise.all(
    ((data ?? []) as ParcelAiImageRecord[]).map((image) => deleteRecord(image)),
  );
}

async function normalizeForAnalysis(image: ParcelAiImageRecord, ownerId: string, draftId: string) {
  ensureActive(image);
  if (image.status === "ready" && image.r2_normalized_key) {
    return getR2Object({ objectKey: image.r2_normalized_key, maxBytes: parcelAiImageMaxBytes });
  }
  const source = await getR2Object({ objectKey: image.r2_original_key, maxBytes: parcelAiImageMaxBytes });
  try {
    const normalized = await sharp(Buffer.from(source.bytes), { limitInputPixels: 24_000_000, failOn: "warning" })
      .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    if (!normalized.byteLength || normalized.byteLength > parcelAiImageMaxBytes) throw new Error("normalized_image_invalid");
    const key = createParcelAiR2ObjectKey(draftId, ownerId, image.original_name.replace(/\.[^.]+$/, ".webp"), "normalized");
    await uploadR2Object({ objectKey: key, body: normalized, contentType: "image/webp", retentionHours: 24 });
    await deleteR2Objects([image.r2_original_key]);
    await db().from("parcel_ai_images").update({ status: "ready", r2_normalized_key: key, normalized_content_type: "image/webp", normalized_size_bytes: normalized.byteLength }).eq("id", image.id);
    return { bytes: new Uint8Array(normalized), contentType: "image/webp" };
  } catch (error) {
    await db().from("parcel_ai_images").update({ status: "failed" }).eq("id", image.id);
    throw error;
  }
}

export async function prepareParcelAiImagesForAnalysis(identity: SupportIdentity, imageIds: string[]): Promise<ParcelAiImageInput[]> {
  if (!imageIds.length) return [];
  const { data, error } = await db().from("parcel_ai_images")
    .select("id,slot,original_name,content_type,size_bytes,r2_original_key,r2_normalized_key,normalized_content_type,status,expires_at,delivery_drafts!inner(id,profile_id,status)")
    .in("id", imageIds).order("slot");
  if (error) throw new Error(error.message);
  const images = (data ?? []) as Array<ParcelAiImageRecord & { delivery_drafts: { id: string; profile_id: string; status: string } }>;
  if (images.length !== imageIds.length || images.some((image) => image.delivery_drafts.profile_id !== identity.profileId || image.delivery_drafts.status !== "active")) throw new Error("image_not_found");
  return Promise.all(images.map(async (image) => {
    const normalized = await normalizeForAnalysis(image, identity.profileId, image.delivery_drafts.id);
    return { id: image.id, slot: image.slot, contentType: "image/webp" as const, dataUrl: `data:image/webp;base64,${Buffer.from(normalized.bytes).toString("base64")}` };
  }));
}
