import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addSupportMessage, getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  const identity = await getSupportIdentity(userId);
  if (!identity) return NextResponse.json({ error: "profile_not_found" }, { status: 401 });
  try { return NextResponse.json(await addSupportMessage(identity, (await params).id, parsed.data.body)); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "support_unavailable";
    const status = reason.endsWith("not_found") ? 404 : reason === "forbidden" || reason === "ticket_read_only" ? 403 : reason.startsWith("ticket_") ? 409 : 502;
    return NextResponse.json({ error: reason }, { status });
  }
}
