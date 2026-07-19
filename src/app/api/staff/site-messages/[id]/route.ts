import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteMessage, replyToSiteMessage, setSiteMessageArchived } from "@/lib/site-messages/server";
import { getSupportIdentity, isAuthorizedSupportOperator } from "@/lib/support/support-hub";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), body: z.string().trim().min(1).max(20_000) }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
]);

async function staffIdentity() {
  const { userId } = await auth();
  if (!userId) return null;
  const identity = await getSupportIdentity(userId);
  return identity && isAuthorizedSupportOperator(identity) ? identity : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await staffIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ message: await getSiteMessage(identity, (await params).id) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "inbox_unavailable";
    return NextResponse.json({ error: reason }, { status: reason === "message_not_found" ? 404 : 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await staffIdentity();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const id = (await params).id;
    const result = parsed.data.action === "reply"
      ? await replyToSiteMessage(identity, id, parsed.data.body)
      : await setSiteMessageArchived(identity, id, parsed.data.action === "archive");
    return NextResponse.json({ result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "inbox_unavailable";
    const status = reason === "message_not_found" ? 404 : reason === "message_archived" ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
