import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteR2Objects } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const { data: expired, error: loadError } = await db
    .from("file_attachments")
    .select("id,r2_object_key")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1_000);

  if (loadError) {
    return NextResponse.json({ error: "attachment_cleanup_query_failed" }, { status: 500 });
  }
  const deletedKeys = expired?.length
    ? await deleteR2Objects(expired.map((attachment) => attachment.r2_object_key))
    : [];
  const deletedKeySet = new Set(deletedKeys);
  const deletedIds = (expired ?? [])
    .filter((attachment) => deletedKeySet.has(attachment.r2_object_key))
    .map((attachment) => attachment.id);

  if (deletedIds.length) {
    const { error: deleteError } = await db.from("file_attachments").delete().in("id", deletedIds);
    if (deleteError) {
      return NextResponse.json({ error: "attachment_cleanup_database_failed" }, { status: 500 });
    }
  }

  const { data: expiredParcelImages, error: parcelImageLoadError } = await db
    .from("parcel_ai_images")
    .select("id,r2_original_key,r2_normalized_key")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1_000);
  if (parcelImageLoadError) {
    return NextResponse.json({ error: "parcel_image_cleanup_query_failed" }, { status: 500 });
  }
  const parcelImageKeys = (expiredParcelImages ?? []).flatMap((image) => [image.r2_original_key, image.r2_normalized_key].filter((key): key is string => Boolean(key)));
  if (parcelImageKeys.length) await deleteR2Objects(parcelImageKeys);
  if (expiredParcelImages?.length) {
    const { error: parcelImageDeleteError } = await db.from("parcel_ai_images").delete().in("id", expiredParcelImages.map((image) => image.id));
    if (parcelImageDeleteError) return NextResponse.json({ error: "parcel_image_cleanup_database_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: deletedIds.length,
    failed: (expired?.length ?? 0) - deletedIds.length,
    deletedParcelAiImages: expiredParcelImages?.length ?? 0,
  });
}
