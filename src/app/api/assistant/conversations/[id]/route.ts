import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversation, getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  const conversationId = (await params).id;
  if (!z.string().uuid().safeParse(conversationId).success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const conversation = await getConversation(identity, conversationId);
    return conversation ? NextResponse.json({ conversation }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) { console.error("[assistant/conversation] get", error); return NextResponse.json({ error: "support_unavailable" }, { status: 502 }); }
}
