import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { addSupportMessage, getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({ body: plainTextSchema(1, 5000) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(schema, request, { maxBytes: 8 * 1024 });
  if (!parsed.ok) return parsed.response;
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  const conversationId = (await params).id;
  if (!z.string().uuid().safeParse(conversationId).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json(await addSupportMessage(identity, conversationId, parsed.data.body)); }
  catch (error) {
    const reason = publicErrorCode(
      error,
      ["conversation_not_found", "forbidden", "ticket_read_only", "ticket_closed"] as const,
      "support_unavailable",
    );
    const status = reason.endsWith("not_found") ? 404 : reason === "forbidden" || reason === "ticket_read_only" ? 403 : reason.startsWith("ticket_") ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
