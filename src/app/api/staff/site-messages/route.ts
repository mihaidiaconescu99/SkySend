import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listSiteMessages } from "@/lib/site-messages/server";
import { getSupportIdentity, isAuthorizedSupportOperator } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getSupportIdentity(userId);
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const status = new URL(request.url).searchParams.get("status");
    return NextResponse.json({ messages: await listSiteMessages(identity, status) });
  } catch (error) {
    console.error("[site-messages] list", error);
    return NextResponse.json({ error: "inbox_unavailable" }, { status: 502 });
  }
}
