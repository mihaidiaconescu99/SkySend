import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupStaffUser, requirePermanentAdminAccess } from "@/lib/staff-access/server";

const emailSchema = z.string().trim().email().max(254);

export async function GET(request: Request) {
  const admin = await requirePermanentAdminAccess(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const parsed = emailSchema.safeParse(new URL(request.url).searchParams.get("email"));
  if (!parsed.success) return NextResponse.json({ error: "Email invalid." }, { status: 400 });
  const user = await lookupStaffUser(parsed.data, admin.access);
  return user
    ? NextResponse.json({ user })
    : NextResponse.json({ error: "Cont inexistent." }, { status: 404 });
}
