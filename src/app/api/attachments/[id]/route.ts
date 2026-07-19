import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAttachmentDownload } from "@/lib/attachments/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try { return NextResponse.redirect(await getAttachmentDownload(identity, (await params).id), 307); }
  catch (error) { const reason = error instanceof Error ? error.message : "attachment_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "forbidden" ? 403 : 404 }); }
}
