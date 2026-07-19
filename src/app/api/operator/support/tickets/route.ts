import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupportIdentity, getTicketCounts, isAuthorizedSupportOperator, listTickets } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const queue = new URL(request.url).searchParams.get("queue") ?? "unassigned";
    const [tickets, counts] = await Promise.all([listTickets(identity, queue), getTicketCounts(identity)]);
    return NextResponse.json({ tickets, counts, identity: { profileId: identity.profileId, role: identity.role } });
  }
  catch (error) { console.error("[operator/support] list", error); return NextResponse.json({ error: "support_unavailable" }, { status: 502 }); }
}
