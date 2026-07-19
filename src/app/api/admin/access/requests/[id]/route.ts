import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminMfa } from "@/lib/staff-access/mfa";
import { decideAdminAccessRequest, requirePermanentAdminAccess } from "@/lib/staff-access/server";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().min(3).max(1000),
  code: z.string().trim().min(6).max(40),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  const mfa = await verifyAdminMfa(admin.access.profileId, parsed.data.code);
  if (!mfa.ok) return NextResponse.json({ error: mfa.error }, { status: 401 });
  try {
    const { id } = await context.params;
    return NextResponse.json({ result: await decideAdminAccessRequest({ requestId: id, decision: parsed.data.decision, note: parsed.data.note, actor: admin.access }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Decizia a eșuat." }, { status: 409 });
  }
}
