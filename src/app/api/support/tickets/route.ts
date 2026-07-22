import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createDirectSupportTicket,
  directSupportTicketSchema,
  getSupportIdentity,
} from "@/lib/support/support-hub";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  const parsed = directSupportTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Completează subiectul, categoria și mesajul." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createDirectSupportTicket(identity, parsed.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ticket_creation_failed";
    return NextResponse.json({ error: message }, { status: message === "order_not_found" ? 404 : 500 });
  }
}
