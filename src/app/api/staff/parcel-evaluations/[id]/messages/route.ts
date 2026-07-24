import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { addParcelEvaluationQuestion } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({ body: plainTextSchema(1, 10_000) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  const parsed = await validateRequest(schema, request, { maxBytes: 16 * 1024 });
  if (!parsed.ok) return parsed.response;
  const evaluationId = (await params).id;
  if (!z.string().uuid().safeParse(evaluationId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ message: await addParcelEvaluationQuestion(identity, evaluationId, parsed.data.body) }); }
  catch (error) {
    const reason = publicErrorCode(error, ["evaluation_not_found", "evaluation_read_only", "evaluation_closed"] as const, "evaluation_unavailable");
    return NextResponse.json({ error: reason }, { status: reason.includes("not_found") ? 404 : reason.includes("read_only") ? 403 : reason === "evaluation_unavailable" ? 502 : 409 });
  }
}
