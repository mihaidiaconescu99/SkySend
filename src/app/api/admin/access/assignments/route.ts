import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminMfa, resetAdminMfa } from "@/lib/staff-access/mfa";
import {
  assignStaffRole,
  lookupStaffUser,
  recordStaffAccessAudit,
  requirePermanentAdminAccess,
  revokeStaffAccess,
} from "@/lib/staff-access/server";
import { adminAccessDurations } from "@/types/staff-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    targetEmail: z.string().trim().email().max(254),
    confirmationEmail: z.string().trim().email().max(254),
    role: z.enum(["operator", "admin"]),
    accessKind: z.enum(["permanent", "temporary"]),
    durationMinutes: z.number().optional(),
    reason: z.string().trim().min(3).max(1000),
    code: z.string().trim().min(6).max(40),
  }),
  z.object({
    action: z.literal("revoke"),
    targetEmail: z.string().trim().email().max(254),
    confirmationEmail: z.string().trim().email().max(254),
    reason: z.string().trim().min(3).max(1000),
    code: z.string().trim().min(6).max(40),
  }),
  z.object({
    action: z.literal("reset_mfa"),
    targetEmail: z.string().trim().email().max(254),
    reason: z.string().trim().min(3).max(1000),
    code: z.string().trim().min(6).max(40),
  }),
]);

export async function POST(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Date invalide.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if ("confirmationEmail" in input && input.confirmationEmail.toLowerCase() !== input.targetEmail.toLowerCase()) {
    return NextResponse.json({ error: "Emailul de confirmare nu corespunde." }, { status: 400 });
  }
  if (input.action === "assign") {
    if (input.role === "operator" && input.accessKind !== "permanent") {
      return NextResponse.json({ error: "Rolul Operator este permanent până la revocare." }, { status: 400 });
    }
    if (input.accessKind === "temporary" && !(adminAccessDurations as readonly number[]).includes(input.durationMinutes ?? -1)) {
      return NextResponse.json({ error: "Durată temporară invalidă." }, { status: 400 });
    }
  }
  const mfa = await verifyAdminMfa(admin.access.profileId, input.code);
  if (!mfa.ok) return NextResponse.json({ error: mfa.error, lockedUntil: mfa.lockedUntil ?? null }, { status: 401 });

  try {
    if (input.action === "revoke") {
      return NextResponse.json({ result: await revokeStaffAccess({ targetEmail: input.targetEmail, reason: input.reason, actor: admin.access }) });
    }
    if (input.action === "reset_mfa") {
      const target = await lookupStaffUser(input.targetEmail, admin.access);
      if (!target?.profileId || target.role !== "admin") return NextResponse.json({ error: "Administratorul nu a fost găsit." }, { status: 404 });
      await resetAdminMfa(target.profileId);
      await recordStaffAccessAudit({
        actorProfileId: admin.access.profileId,
        actorRole: admin.access.role,
        action: "admin_mfa_reset",
        entityType: "admin_mfa_credentials",
        entityId: target.profileId,
        changes: { targetEmail: input.targetEmail.toLowerCase(), reason: input.reason },
      });
      return NextResponse.json({ result: { reset: true } });
    }
    return NextResponse.json({
      result: await assignStaffRole({
        targetEmail: input.targetEmail,
        role: input.role,
        accessKind: input.accessKind,
        durationMinutes: input.durationMinutes as 60 | 240 | 1440 | 10080 | undefined,
        reason: input.reason,
        actor: admin.access,
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operația a eșuat." }, { status: 409 });
  }
}
