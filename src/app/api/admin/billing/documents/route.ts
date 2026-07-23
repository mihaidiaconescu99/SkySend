import { NextResponse } from "next/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";

export async function GET(request: Request) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "order_id_required" }, { status: 400 });
  const database = createAdminSupabaseClient() as any;
  const { data: order } = await database.from("orders").select("id")
    .eq(getOrderIdentifierColumn(orderId), orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const { data, error } = await database.from("billing_documents")
    .select("id,document_type,document_number,generation_status,attempt_count,last_error_code,last_error_message")
    .eq("order_id", order.id).order("issued_at");
  if (error) return NextResponse.json({ error: "documents_failed" }, { status: 502 });
  return NextResponse.json({ documents: data ?? [] });
}
