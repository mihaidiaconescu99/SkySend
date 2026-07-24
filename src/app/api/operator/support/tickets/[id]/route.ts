import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { getSupportIdentity, updateTicket } from "@/lib/support/support-hub";
const schema = z.object({ action: z.enum(["claim", "release", "close"]) }).strict();
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  const parsed = await validateRequest(schema, request, { maxBytes: 2 * 1024 });
  if (!parsed.ok) return parsed.response;
  const ticketId = (await params).id;
  if (!z.string().uuid().safeParse(ticketId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ ticket: await updateTicket(identity, ticketId, parsed.data.action) }); }
  catch (error) {
    const reason = publicErrorCode(error, ["forbidden", "ticket_not_owned", "ticket_not_found", "ticket_closed", "ticket_already_claimed", "ticket_not_claimed", "ticket_changed"] as const, "support_unavailable");
    const status = reason === "forbidden" || reason === "ticket_not_owned" ? 403 : reason === "ticket_not_found" ? 404 : reason.startsWith("ticket_") ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
