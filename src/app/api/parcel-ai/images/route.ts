import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { uploadFileNameSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { requireSameOrigin } from "@/lib/api/request-security";
import { createParcelAiImageUpload, listParcelAiImages, removeParcelAiImage, removeParcelAiImagesForDraft } from "@/lib/parcel-ai-images/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const createSchema = z.object({ draftId: z.string().uuid(), slot: z.number().int().min(0).max(1), fileName: uploadFileNameSchema, contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).strict();
async function identity() { const { userId } = await auth(); return userId ? getSupportIdentity(userId) : null; }
export async function GET(request: Request) {
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const draftId = new URL(request.url).searchParams.get("draftId"); if (!z.string().uuid().safeParse(draftId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ images: await listParcelAiImages(actor, draftId as string) }); } catch { return NextResponse.json({ error: "images_unavailable" }, { status: 404 }); }
}
export async function POST(request: Request) {
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(createSchema, request, { maxBytes: 4 * 1024 }); if (!parsed.ok) return parsed.response;
  try { return NextResponse.json(await createParcelAiImageUpload(actor, parsed.data)); } catch (error) {
    const reason = publicErrorCode(error, ["draft_not_found", "invalid_image", "image_slot_taken"] as const, "upload_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "draft_not_found" ? 404 : 409 });
  }
}
export async function DELETE(request: Request) {
  const originFailure = requireSameOrigin(request); if (originFailure) return originFailure;
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const imageId = searchParams.get("imageId");
  const draftId = searchParams.get("draftId");
  if ((imageId && draftId) || (!imageId && !draftId) || (imageId && !z.string().uuid().safeParse(imageId).success) || (draftId && !z.string().uuid().safeParse(draftId).success)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    if (draftId) await removeParcelAiImagesForDraft(actor, draftId);
    else await removeParcelAiImage(actor, imageId as string);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: imageId ? "image_not_found" : "draft_not_found" }, { status: 404 });
  }
}
