import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { answerParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.object({ body: z.string().trim().min(1).max(10_000), replyToMessageId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ message: await answerParcelEvaluation(identity, (await params).id, parsed.data) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "evaluation_unavailable"; return NextResponse.json({ error: reason }, { status: reason === "evaluation_not_found" ? 404 : 409 }); }
}
