

import "server-only";

import { NextResponse } from "next/server";

import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getAdminOrdersFromDB } from "@/lib/admin-data-server";

export async function GET() {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const orders = await getAdminOrdersFromDB();
  return NextResponse.json({ orders });
}
