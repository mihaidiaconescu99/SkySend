import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAttachmentUpload } from "@/lib/attachments/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  scope: z.enum(["support", "evaluation"]),
  parentId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});
export async function POST(request: Request) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json(await createAttachmentUpload(identity, parsed.data)); }
  catch (error) { const reason = error instanceof Error ? error.message : "upload_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "forbidden" || reason.endsWith("read_only") ? 403 : reason.endsWith("not_found") ? 404 : 409 }); }
}
