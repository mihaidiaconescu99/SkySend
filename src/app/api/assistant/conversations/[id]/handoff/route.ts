import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupportIdentity, handoffConversation } from "@/lib/support/support-hub";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  try { return NextResponse.json({ ticket: await handoffConversation(identity, (await params).id) }, { status: 201 }); }
  catch (error) { const reason = error instanceof Error ? error.message : "support_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "conversation_not_found" ? 404 : 502 }); }
}
