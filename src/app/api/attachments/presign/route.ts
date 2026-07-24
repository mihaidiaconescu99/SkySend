import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { createAttachmentUpload } from "@/lib/attachments/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({
  scope: z.enum(["support", "evaluation"]),
  parentId: z.string().uuid(),
  fileName: plainTextSchema(1, 255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
}).strict();
export async function POST(request: Request) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(schema, request, { maxBytes: 4 * 1024 });
  if (!parsed.ok) return parsed.response;
  try { return NextResponse.json(await createAttachmentUpload(identity, parsed.data)); }
  catch (error) {
    const reason = publicErrorCode(
      error,
      ["forbidden", "ticket_read_only", "evaluation_read_only", "message_not_found", "ticket_closed", "evaluation_closed", "invalid_image", "attachment_limit"] as const,
      "upload_unavailable",
    );
    const status = reason === "forbidden" || reason.endsWith("read_only") ? 403 : reason.endsWith("not_found") ? 404 : 409;
    return NextResponse.json({ error: reason }, { status });
  }
}
