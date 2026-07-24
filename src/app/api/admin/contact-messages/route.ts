

import "server-only";

import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api/rate-limit";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getAdminContactMessageDetailsFromDB } from "@/lib/admin-data-server";

export async function GET(
  request = new Request("http://localhost/api/admin/contact-messages"),
) {
  const rateLimit = await enforceRateLimit(request, "admin-read");
  if (rateLimit) return rateLimit;
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
