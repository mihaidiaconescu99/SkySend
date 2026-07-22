import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createParcelAiImageUpload, listParcelAiImages, removeParcelAiImage, removeParcelAiImagesForDraft } from "@/lib/parcel-ai-images/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const createSchema = z.object({ draftId: z.string().uuid(), slot: z.number().int().min(0).max(1), fileName: z.string().trim().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) });
async function identity() { const { userId } = await auth(); return userId ? getSupportIdentity(userId) : null; }
export async function GET(request: Request) {
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const draftId = new URL(request.url).searchParams.get("draftId"); if (!draftId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ images: await listParcelAiImages(actor, draftId) }); } catch { return NextResponse.json({ error: "images_unavailable" }, { status: 404 }); }
}
export async function POST(request: Request) {
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json(await createParcelAiImageUpload(actor, parsed.data)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "upload_unavailable" }, { status: 409 }); }
}
export async function DELETE(request: Request) {
  const actor = await identity(); if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  const imageId = searchParams.get("imageId");
  const draftId = searchParams.get("draftId");
  if ((imageId && draftId) || (!imageId && !draftId)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    if (draftId) await removeParcelAiImagesForDraft(actor, draftId);
    else await removeParcelAiImage(actor, imageId as string);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: imageId ? "image_not_found" : "draft_not_found" }, { status: 404 });
  }
}
