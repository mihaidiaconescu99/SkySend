import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listParcelEvaluations } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity, isAuthorizedSupportOperator } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try { return NextResponse.json({ evaluations: await listParcelEvaluations(identity, new URL(request.url).searchParams.get("status")), identity: { profileId: identity.profileId, role: identity.role } }); }
  catch { return NextResponse.json({ error: "evaluation_unavailable" }, { status: 502 }); }
}
