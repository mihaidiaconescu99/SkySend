import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { listParcelEvaluations } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  const status = z.enum([
    "all",
    "requested",
    "in_review",
    "in_evaluation",
    "waiting_customer",
    "customer_replied",
    "finalized",
    "cancelled",
    "closed",
  ])
    .nullable()
    .safeParse(new URL(request.url).searchParams.get("status"));
  if (!status.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try { return NextResponse.json({ evaluations: await listParcelEvaluations(identity, status.data), identity: { profileId: identity.profileId, role: identity.role } }); }
  catch { return NextResponse.json({ error: "evaluation_unavailable" }, { status: 502 }); }
}
