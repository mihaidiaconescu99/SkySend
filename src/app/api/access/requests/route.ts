import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAccessDurations } from "@/types/staff-access";
import {
  cancelOwnAdminAccessRequest,
  createAdminAccessRequest,
  getCurrentStaffAccess,
  getOwnAdminAccessRequest,
} from "@/lib/staff-access/server";

const schema = z.object({
  duration: z.number().refine((value) => (adminAccessDurations as readonly number[]).includes(value)),
  reason: z.string().trim().min(20).max(1000),
});

export async function GET() {
  const access = await getCurrentStaffAccess();
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ request: await getOwnAdminAccessRequest(access) });
}

export async function POST(request: Request) {
  const access = await getCurrentStaffAccess();
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await createAdminAccessRequest({
      access,
      duration: parsed.data.duration as 60 | 240 | 1440 | 10080,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ request: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "request_failed" }, { status: 409 });
  }
}
export async function DELETE() {
  const access = await getCurrentStaffAccess();
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json({ request: await cancelOwnAdminAccessRequest(access) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "cancel_failed" }, { status: 409 });
  }
}
