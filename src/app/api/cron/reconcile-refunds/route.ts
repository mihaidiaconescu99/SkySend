import "server-only";

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { reconcilePendingRefunds } from "@/lib/refund-reconciliation-server";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcilePendingRefunds(createAdminSupabaseClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/reconcile-refunds] reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed." }, { status: 502 });
  }
}
