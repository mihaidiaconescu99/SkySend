import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { deliveryDraftPayloadSchema } from "@/lib/delivery-input-schemas";
import { completeDeliveryDraft, getClientEvaluation, getOrCreateDeliveryDraft, saveDeliveryDraft } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  id: z.string().uuid(),
  currentStep: z.enum(["route", "parcel", "options", "review"]),
  payload: deliveryDraftPayloadSchema,
}).strict();

const submitSchema = z.object({
  id: z.string().uuid(),
  action: z.literal("submit"),
}).strict();

async function identity() {
  const { userId } = await auth();
  return userId ? getSupportIdentity(userId) : null;
}

export async function GET() {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
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
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const actor = await identity();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(schema, request, {
    maxBytes: 128 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try { return NextResponse.json({ draft: await saveDeliveryDraft(actor, parsed.data) }); }
  catch (error) {
    const reason = publicErrorCode(error, ["draft_not_found"] as const, "draft_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "draft_not_found" ? 404 : 502 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const actor = await identity();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(submitSchema, request, {
    maxBytes: 4 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try { return NextResponse.json({ draft: await completeDeliveryDraft(actor, parsed.data.id) }); }
  catch (error) {
    const reason = publicErrorCode(error, ["draft_not_found"] as const, "draft_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "draft_not_found" ? 404 : 502 });
  }
}
