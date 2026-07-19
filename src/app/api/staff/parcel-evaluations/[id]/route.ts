import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeParcelEvaluation, releaseParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity, isAuthorizedSupportOperator } from "@/lib/support/support-hub";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("finalize"), weightKg: z.number().positive().max(100_000), lengthCm: z.number().positive().max(100_000), widthCm: z.number().positive().max(100_000), heightCm: z.number().positive().max(100_000), warnings: z.array(z.enum(["fragile", "temperature", "liquid", "humidity", "orientation"])).max(5) }),
]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const identity = userId ? await getSupportIdentity(userId) : null;
  if (!identity || !isAuthorizedSupportOperator(identity)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const id = (await params).id;
    const evaluation = parsed.data.action === "release" ? await releaseParcelEvaluation(identity, id) : await finalizeParcelEvaluation(identity, id, parsed.data);
    return NextResponse.json({ evaluation });
  } catch (error) { const reason = error instanceof Error ? error.message : "evaluation_unavailable"; return NextResponse.json({ error: reason }, { status: reason.includes("not_found") ? 404 : reason.includes("read_only") ? 403 : 409 }); }
}
