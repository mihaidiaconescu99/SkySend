import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addParcelEvaluationQuestion } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity, isAuthorizedSupportOperator } from "@/lib/support/support-hub";

const schema = z.object({ body: z.string().trim().min(1).max(10_000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try { return NextResponse.json({ message: await addParcelEvaluationQuestion(identity, (await params).id, parsed.data.body) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "evaluation_unavailable"; return NextResponse.json({ error: reason }, { status: reason.includes("not_found") ? 404 : reason.includes("read_only") ? 403 : 409 }); }
}
