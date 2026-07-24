import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { publicErrorCode } from "@/lib/api/validation";
import { cancelParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const evaluationId = (await params).id;
  if (!z.string().uuid().safeParse(evaluationId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ evaluation: await cancelParcelEvaluation(identity, evaluationId) }); }
  catch (error) {
    const reason = publicErrorCode(error, ["evaluation_not_found", "evaluation_closed"] as const, "evaluation_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "evaluation_not_found" ? 404 : reason === "evaluation_unavailable" ? 502 : 409 });
  }
}
