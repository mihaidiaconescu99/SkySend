

import "server-only";

import { NextResponse } from "next/server";

import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getAdminContactMessageDetailsFromDB } from "@/lib/admin-data-server";

export async function GET() {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const messages = await getAdminContactMessageDetailsFromDB();
  return NextResponse.json({ messages });
}
