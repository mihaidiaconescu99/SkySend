import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { completeDeliveryDraft, getClientEvaluation, getOrCreateDeliveryDraft, saveDeliveryDraft } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  id: z.string().uuid(),
  currentStep: z.enum(["route", "parcel", "options", "review"]),
  payload: z.record(z.string(), z.unknown()),
});

async function identity() {
  const { userId } = await auth();
  return userId ? getSupportIdentity(userId) : null;
}

export async function GET() {
  const actor = await identity();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const draft = await getOrCreateDeliveryDraft(actor);
    const evaluation = await getClientEvaluation(actor, draft.id);
    return NextResponse.json({ draft, evaluation });
  }
  catch (error) { console.error("[delivery-draft] get", error); return NextResponse.json({ error: "draft_unavailable" }, { status: 502 }); }
}

export async function PUT(request: Request) {
  const actor = await identity();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ draft: await saveDeliveryDraft(actor, parsed.data) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "draft_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "draft_not_found" ? 404 : 502 }); }
}

export async function POST(request: Request) {
  const actor = await identity();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), action: z.literal("submit") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ draft: await completeDeliveryDraft(actor, parsed.data.id) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "draft_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "draft_not_found" ? 404 : 502 }); }
}
