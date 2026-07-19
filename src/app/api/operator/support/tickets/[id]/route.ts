import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupportIdentity, isAuthorizedSupportOperator, updateTicket } from "@/lib/support/support-hub";
const schema = z.object({ action: z.enum(["claim", "release", "close"]) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ ticket: await updateTicket(identity, (await params).id, parsed.data.action) }); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "support_unavailable";
    const status = reason === "forbidden" || reason === "ticket_not_owned" ? 403 : reason === "ticket_not_found" ? 404 : reason.startsWith("ticket_") ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
