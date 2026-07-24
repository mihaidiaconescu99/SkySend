import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { getSupportIdentity, getTicketCounts, listTickets } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  try {
    const queueResult = z.enum(["unassigned", "claimed", "waiting_customer", "closed"])
      .safeParse(new URL(request.url).searchParams.get("queue") ?? "unassigned");
    if (!queueResult.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const queue = queueResult.data;
    const [tickets, counts] = await Promise.all([listTickets(identity, queue), getTicketCounts(identity)]);
    return NextResponse.json({ tickets, counts, identity: { profileId: identity.profileId, role: identity.role } });
  }
  catch (error) { console.error("[operator/support] list", error); return NextResponse.json({ error: "support_unavailable" }, { status: 502 }); }
}
