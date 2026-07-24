import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { finalizeParcelEvaluation, releaseParcelEvaluation } from "@/lib/parcel-evaluations/server";
import { getSupportIdentity } from "@/lib/support/support-hub";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("release") }).strict(),
  z.object({ action: z.literal("finalize"), weightKg: z.number().finite().positive().max(12), lengthCm: z.number().finite().positive().max(300), widthCm: z.number().finite().positive().max(300), heightCm: z.number().finite().positive().max(300), warnings: z.array(z.enum(["fragile", "temperature", "liquid", "humidity", "orientation"])).max(5) }).strict(),
]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(["operator", "admin"]);
  if (!authorization.ok) return authorization.response;
  const identity = await getSupportIdentity(authorization.context.userId);
  if (!identity) return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  const parsed = await validateRequest(schema, request, { maxBytes: 8 * 1024 });
  if (!parsed.ok) return parsed.response;
  try {
    const id = (await params).id;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const evaluation = parsed.data.action === "release" ? await releaseParcelEvaluation(identity, id) : await finalizeParcelEvaluation(identity, id, parsed.data);
    return NextResponse.json({ evaluation });
  } catch (error) {
    const reason = publicErrorCode(error, ["evaluation_not_found", "evaluation_read_only", "evaluation_changed"] as const, "evaluation_unavailable");
    return NextResponse.json({ error: reason }, { status: reason.includes("not_found") ? 404 : reason.includes("read_only") ? 403 : reason === "evaluation_unavailable" ? 502 : 409 });
  }
}
