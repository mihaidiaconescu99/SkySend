import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createParcelEvaluation, getClientEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  draftId: z.string().uuid(),
  description: z.string().trim().min(3).max(10_000),
  parcelSnapshot: z.record(z.string(), z.unknown()),
  estimateTrace: z.record(z.string(), z.unknown()).nullable().optional(),
});

async function actor() { const { userId } = await auth(); return userId ? getSupportIdentity(userId) : null; }

export async function GET(request: Request) {
  const identity = await actor();
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const viewId = params.get("viewId");
  if (viewId && !z.string().uuid().safeParse(viewId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ evaluation: await getClientEvaluation(identity, params.get("draftId"), viewId) }); }
  catch { return NextResponse.json({ error: "evaluation_unavailable" }, { status: 502 }); }
}

export async function POST(request: Request) {
  const identity = await actor();
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ evaluation: await createParcelEvaluation(identity, parsed.data) }, { status: 201 }); }
  catch (error) { const reason = error instanceof Error ? error.message : "evaluation_unavailable"; return NextResponse.json({ error: reason }, { status: reason.startsWith("evaluation_") ? 409 : reason === "draft_not_found" ? 404 : 502 }); }
}
