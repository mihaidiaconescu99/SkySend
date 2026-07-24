import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { listParcelEvaluations } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  try { return NextResponse.json({ evaluations: await listParcelEvaluations(identity, new URL(request.url).searchParams.get("status")), identity: { profileId: identity.profileId, role: identity.role } }); }
  catch { return NextResponse.json({ error: "evaluation_unavailable" }, { status: 502 }); }
}
