import { NextResponse } from "next/server";
import { z } from "zod";
import {
  beginAdminMfaEnrollment,
  confirmAdminMfaEnrollment,
  getAdminMfaStatus,
} from "@/lib/staff-access/mfa";
import { recordStaffAccessAudit, requirePermanentAdminAccess } from "@/lib/staff-access/server";

const confirmSchema = z.object({ code: z.string().regex(/^\d{6}$/u) });

export async function GET(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  return NextResponse.json({ mfa: await getAdminMfaStatus(admin.access.profileId) });
}

export async function POST(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    return NextResponse.json({ enrollment: await beginAdminMfaEnrollment(admin.access.profileId, admin.access.email) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MFA nu a putut fi inițiat." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cod invalid." }, { status: 400 });
  const result = await confirmAdminMfaEnrollment(admin.access.profileId, parsed.data.code);
  if (result.ok) {
    await recordStaffAccessAudit({
      actorProfileId: admin.access.profileId,
      actorRole: admin.access.role,
      action: "admin_mfa_enrolled",
      entityType: "admin_mfa_credentials",
      entityId: admin.access.profileId,
      changes: { recoveryCodeCount: result.recoveryCodes.length },
    });
  }
  return result.ok
    ? NextResponse.json({ recoveryCodes: result.recoveryCodes })
    : NextResponse.json({ error: result.error }, { status: 401 });
}
