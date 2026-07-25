import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
}

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, "admin-read");
  if (rateLimit) return rateLimit;
  const authorization = await requireAdminPanelUser();
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("type");
  if (kind !== "orders" && kind !== "financial") {
    return NextResponse.json({ error: "invalid_export_type" }, { status: 400 });
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const database = createAdminSupabaseClient();
  let rows: Record<string, unknown>[] = [];

  if (kind === "orders") {
    let query = database
      .from("orders")
      .select(
        "local_order_id,status,payment_status,fulfillment_status,total_amount_minor,currency,created_at,updated_at",
      )
      .order("created_at", { ascending: false });
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    if (status) query = query.eq("status", status);
    const result = await query;
    if (result.error) {
      return NextResponse.json({ error: "export_query_failed" }, { status: 502 });
    }
    rows = result.data ?? [];
  } else {
    let query = database
      .from("payment_records")
      .select(
        "order_id,type,status,amount_minor,currency,stripe_payment_intent_id,stripe_refund_id,created_at",
      )
      .order("created_at", { ascending: false });
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    const result = await query;
    if (result.error) {
      return NextResponse.json({ error: "export_query_failed" }, { status: 502 });
    }
    rows = (result.data ?? []).map((record: Record<string, unknown>) => ({
      ...record,
      net_amount_minor:
        record.type === "payment"
          ? record.amount_minor
          : -Number(record.amount_minor ?? 0),
    }));
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skysend-${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
