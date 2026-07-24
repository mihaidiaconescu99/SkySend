import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { answerParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({ body: plainTextSchema(1, 10_000), replyToMessageId: z.string().uuid() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(schema, request, { maxBytes: 16 * 1024 });
  if (!parsed.ok) return parsed.response;
  const evaluationId = (await params).id;
  if (!z.string().uuid().safeParse(evaluationId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ message: await answerParcelEvaluation(identity, evaluationId, parsed.data) }); }
  catch (error) {
    const reason = publicErrorCode(
      error,
      ["evaluation_not_found", "evaluation_read_only", "question_not_found"] as const,
      "evaluation_unavailable",
    );
    return NextResponse.json({ error: reason }, { status: reason === "evaluation_not_found" ? 404 : reason === "evaluation_unavailable" ? 502 : 409 });
  }
}
