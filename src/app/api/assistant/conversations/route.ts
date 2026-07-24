import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/api/request-security";
import { createConversation, getSupportIdentity, listConversations } from "@/lib/support/support-hub";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  try { return NextResponse.json({ conversations: await listConversations(identity) }); }
  catch (error) { console.error("[assistant/conversations] list", error); return NextResponse.json({ error: "support_unavailable" }, { status: 502 }); }
}

export async function POST(request: Request) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  try { return NextResponse.json({ conversation: await createConversation(identity) }, { status: 201 }); }
  catch (error) { console.error("[assistant/conversations] create", error); return NextResponse.json({ error: "support_unavailable" }, { status: 502 }); }
}
