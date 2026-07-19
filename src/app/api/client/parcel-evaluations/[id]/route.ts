import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cancelParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try { return NextResponse.json({ evaluation: await cancelParcelEvaluation(identity, (await params).id) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "evaluation_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "evaluation_not_found" ? 404 : 409 }); }
}
