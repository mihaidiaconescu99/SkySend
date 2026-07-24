import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import {
  createDirectSupportTicket,
  directSupportTicketSchema,
  getSupportIdentity,
} from "@/lib/support/support-hub";

export async function POST(request: Request) {
  const { userId } = await auth();
  const rateLimit = await enforceRateLimit(request, "support", { userId });
  if (rateLimit) return rateLimit;
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  const parsed = await validateRequest(directSupportTicketSchema, request, {
    maxBytes: 16 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await createDirectSupportTicket(identity, parsed.data), { status: 201 });
  } catch (error) {
    const message = publicErrorCode(error, ["order_not_found"] as const, "ticket_creation_failed");
    return NextResponse.json({ error: message }, { status: message === "order_not_found" ? 404 : 500 });
  }
}
