import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { listSiteMessages } from "@/lib/site-messages/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  try {
    const status = new URL(request.url).searchParams.get("status");
    return NextResponse.json({ messages: await listSiteMessages(identity, status) });
  } catch (error) {
    console.error("[site-messages] list", error);
    return NextResponse.json({ error: "inbox_unavailable" }, { status: 502 });
  }
}
