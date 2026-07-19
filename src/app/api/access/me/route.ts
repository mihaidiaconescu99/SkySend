import { NextResponse } from "next/server";
import { getAdminMfaStatus } from "@/lib/staff-access/mfa";
import { getCurrentStaffAccess, getOwnAdminAccessRequest } from "@/lib/staff-access/server";

export async function GET() {
  const access = await getCurrentStaffAccess();
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [request, mfa] = await Promise.all([
    access.role === "operator" ? getOwnAdminAccessRequest(access) : Promise.resolve(null),
    access.isPermanentAdmin ? getAdminMfaStatus(access.profileId) : Promise.resolve({ enrolled: false, lockedUntil: null }),
  ]);
  return NextResponse.json({ access, request, mfa });
}
