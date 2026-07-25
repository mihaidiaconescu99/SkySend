

import "server-only";

import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api/rate-limit";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getAdminOrdersFromDB } from "@/lib/admin-data-server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  request = new Request("http://localhost/api/admin/orders"),
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

  const orders = await getAdminOrdersFromDB();
  const database = createAdminSupabaseClient();
  const { data: workflows } = await database
    .from("incident_workflows")
    .select("order_id,status,resolution_note,updated_at");
  const workflowByOrderId = new Map(
    (workflows ?? []).map((workflow) => [workflow.order_id, workflow]),
  );
  const enrichedOrders = orders.map((order) => {
    const workflow = workflowByOrderId.get(order.id);
    if (!workflow) return order;
    return {
      ...order,
      resolutionStatus: workflow.status,
      resolutionStatusLabel:
        workflow.status === "in_progress"
          ? "În lucru"
          : workflow.status === "resolved"
            ? "Rezolvat"
            : workflow.status === "archived"
              ? "Arhivat"
              : "Deschis",
      internalNotes: workflow.resolution_note ?? order.internalNotes,
      updatedAt: workflow.updated_at ?? order.updatedAt,
    };
  });
  return NextResponse.json({ orders: enrichedOrders });
}
