import { NextResponse } from "next/server";
import { listAdminAccessRequests, requirePermanentAdminAccess } from "@/lib/staff-access/server";

export async function GET(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  return NextResponse.json({ requests: await listAdminAccessRequests() });
}
