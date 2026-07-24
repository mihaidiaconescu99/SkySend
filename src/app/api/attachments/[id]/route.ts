import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { publicErrorCode } from "@/lib/api/validation";
import { getAttachmentDownload } from "@/lib/attachments/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const attachmentId = (await params).id;
  if (!z.string().uuid().safeParse(attachmentId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.redirect(await getAttachmentDownload(identity, attachmentId), 307); }
  catch (error) {
    const reason = publicErrorCode(error, ["forbidden", "attachment_not_found"] as const, "attachment_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "forbidden" ? 403 : reason === "attachment_not_found" ? 404 : 502 });
  }
}
