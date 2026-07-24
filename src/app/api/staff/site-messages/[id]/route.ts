import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { getSiteMessage, replyToSiteMessage, setSiteMessageArchived } from "@/lib/site-messages/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), body: plainTextSchema(1, 20_000) }).strict(),
  z.object({ action: z.literal("archive") }).strict(),
  z.object({ action: z.literal("restore") }).strict(),
]);

async function staffIdentity() {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "identity_unavailable" },
        { status: 503 },
      ),
    };
  }
  return { ok: true as const, identity };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await staffIdentity();
  if (!staff.ok) return staff.response;
  const { identity } = staff;
  try {
    const id = (await params).id;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    return NextResponse.json({ message: await getSiteMessage(identity, id) });
  } catch (error) {
    const reason = publicErrorCode(error, ["message_not_found"] as const, "inbox_unavailable");
    return NextResponse.json({ error: reason }, { status: reason === "message_not_found" ? 404 : 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await staffIdentity();
  if (!staff.ok) return staff.response;
  const { identity } = staff;
  const parsed = await validateRequest(patchSchema, request, { maxBytes: 24 * 1024 });
  if (!parsed.ok) return parsed.response;
  try {
    const id = (await params).id;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const result = parsed.data.action === "reply"
      ? await replyToSiteMessage(identity, id, parsed.data.body)
      : await setSiteMessageArchived(identity, id, parsed.data.action === "archive");
    return NextResponse.json({ result });
  } catch (error) {
    const reason = publicErrorCode(error, ["message_not_found", "message_archived"] as const, "inbox_unavailable");
    const status = reason === "message_not_found" ? 404 : reason === "message_archived" ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
