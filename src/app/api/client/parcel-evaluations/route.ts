import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { boundedJsonValueSchema, plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { parcelEvaluationSnapshotSchema } from "@/lib/delivery-input-schemas";
import { createParcelEvaluation, getClientEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  draftId: z.string().uuid(),
  description: plainTextSchema(3, 10_000),
  parcelSnapshot: parcelEvaluationSnapshotSchema,
  estimateTrace: boundedJsonValueSchema({
    maxDepth: 10,
    maxArrayLength: 100,
    maxObjectKeys: 100,
    maxStringLength: 2_000,
  }).nullable().optional(),
}).strict();

async function actor() { const { userId } = await auth(); return userId ? getSupportIdentity(userId) : null; }

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const identity = await actor();
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const viewId = params.get("viewId");
  const draftId = params.get("draftId");
  if (viewId && !z.string().uuid().safeParse(viewId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  if (draftId && !z.string().uuid().safeParse(draftId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ evaluation: await getClientEvaluation(identity, draftId, viewId) }); }
  catch { return NextResponse.json({ error: "evaluation_unavailable" }, { status: 502 }); }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const identity = await actor();
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(schema, request, {
    maxBytes: 96 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({
      evaluation: await createParcelEvaluation(identity, {
        ...parsed.data,
        estimateTrace: parsed.data.estimateTrace as Record<string, unknown> | null | undefined,
      }),
    }, { status: 201 });
  }
  catch (error) {
    const reason = publicErrorCode(
      error,
      ["evaluation_exists", "evaluation_closed", "draft_not_found"] as const,
      "evaluation_unavailable",
    );
    return NextResponse.json({ error: reason }, { status: reason.startsWith("evaluation_") ? 409 : reason === "draft_not_found" ? 404 : 502 });
  }
}
