import { NextResponse } from "next/server";
import { z } from "zod";
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
    const parsedStatus = z.enum(["all", "new", "read", "replied", "archived"])
      .nullable()
      .safeParse(status);
    if (!parsedStatus.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    return NextResponse.json({ messages: await listSiteMessages(identity, parsedStatus.data) });
  } catch (error) {
    console.error("[site-messages] list", error);
    return NextResponse.json({ error: "inbox_unavailable" }, { status: 502 });
  }
}
