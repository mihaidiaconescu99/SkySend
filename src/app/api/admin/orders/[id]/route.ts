

import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  opaqueIdentifierSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { validateRequest } from "@/lib/api/validation";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { mapRepoOrderToAdminOrder } from "@/lib/admin-order-mapper";
import { processEligibleRefund } from "@/lib/refund-reconciliation-server";
import { sendSupportEmail } from "@/lib/email/support-email";
import type { OrderStatus as DomainOrderStatus } from "@/types/domain";
import type { OrderStatus, UpdateOrderInput } from "@/types/order";

const PatchSchema = z
  .object({
    status: z
      .enum([
        "draft",
        "scheduled",
        "queued",
        "in_flight",
        "delivered",
        "failed",
        "cancelled",
        "returned",
      ])
      .optional(),
    fulfillmentStatus: z.enum([
      "order_created",
      "active_mission",
      "completed_mission",
      "failed_mission",
      "fallback_required",
      "canceled",
    ]).nullable().optional(),
    internalNotes: plainTextSchema(1, 2_000).nullable().optional(),
    resolutionStatus: z
      .enum(["open", "in_progress", "waiting_for_customer", "resolved", "archived"])
      .optional(),
    refundStatus: z
      .enum(["unknown", "not_required", "pending", "started", "completed", "failed"])
      .optional(),
    customerNotificationStatus: z
      .enum(["unknown", "not_required", "not_sent", "prepared", "queued", "sent"])
      .optional(),
    changeReason: plainTextSchema(1, 2_000).optional(),
  })
  .strict();

function mapDomainStatusToRepo(
  status: DomainOrderStatus,
): OrderStatus | null {
  switch (status) {
    case "queued":
    case "scheduled":
    case "draft":
      return "pending";
    case "in_flight":
      return "in_progress";
    case "delivered":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "returned":
      return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimit = await enforceRateLimit(request, "admin-write");
  if (rateLimit) return rateLimit;
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  if (!opaqueIdentifierSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid order identifier." }, { status: 400 });
  }

  const parsed = await validateRequest(PatchSchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = createAdminSupabaseClient();
  const database = supabase;
  const orders = new OrdersRepository(supabase);
  const existing = await orders.getById(id);
  if (!existing.ok) {
    return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const patch: UpdateOrderInput = {};

  if (body.status !== undefined) {
    const mapped = mapDomainStatusToRepo(body.status);
    if (mapped !== null) {
      patch.status = mapped;
    }
  }
  if (body.fulfillmentStatus !== undefined) {
    patch.fulfillmentStatus = body.fulfillmentStatus;
  }
  if (body.internalNotes !== undefined) {
    patch.notes = body.internalNotes;
  }

  let incidentId: string | null = null;
  if (
    body.resolutionStatus !== undefined ||
    body.refundStatus !== undefined ||
    body.customerNotificationStatus !== undefined
  ) {
    const workflowStatus =
      body.resolutionStatus === "waiting_for_customer"
        ? "in_progress"
        : body.resolutionStatus;
    const workflowPatch = {
      ...(workflowStatus ? { status: workflowStatus } : {}),
      ...(workflowStatus === "resolved"
        ? { resolved_at: new Date().toISOString(), resolution_note: body.changeReason ?? null }
        : {}),
      ...(workflowStatus === "archived"
        ? { archived_at: new Date().toISOString() }
        : {}),
      assigned_profile_id: authResult.profile.id,
    };
    const { data: incident, error: incidentError } = await database
      .from("incident_workflows")
      .upsert(
        { order_id: existing.data.id, ...workflowPatch },
        { onConflict: "order_id" },
      )
      .select("id")
      .single();
    if (incidentError || !incident) {
      return NextResponse.json({ error: "incident_update_failed" }, { status: 502 });
    }
    incidentId = incident.id;
    if (body.internalNotes?.trim()) {
      await database.from("incident_notes").insert({
        incident_id: incidentId,
        author_profile_id: authResult.profile.id,
        body: body.internalNotes.trim(),
      });
    }
  }

  if (body.refundStatus === "started" || body.refundStatus === "completed") {
    if (!body.changeReason?.trim()) {
      return NextResponse.json(
        { error: "refund_reason_required" },
        { status: 400 },
      );
    }
    const result = await processEligibleRefund(
      supabase,
      existing.data,
      body.changeReason.trim(),
    );
    if (result === "not_eligible") {
      return NextResponse.json({ error: "refund_not_eligible" }, { status: 409 });
    }
  }

  if (body.customerNotificationStatus === "sent" && incidentId) {
    const { data: profile } = await database
      .from("profiles")
      .select("email")
      .eq("id", existing.data.senderProfileId)
      .maybeSingle();
    if (!profile?.email) {
      return NextResponse.json({ error: "client_email_missing" }, { status: 409 });
    }
    try {
      const result = await sendSupportEmail({
        to: profile.email,
        title: `Actualizare incident ${existing.data.localOrderId}`,
        message:
          body.changeReason ??
          "Incidentul livrării tale a fost actualizat de echipa SkySend.",
        ticketId: incidentId,
      });
      if (result.skipped) throw new Error("email_provider_not_configured");
      await database.from("incident_notifications").insert({
        incident_id: incidentId,
        recipient_email: profile.email,
        subject: `Actualizare incident ${existing.data.localOrderId}`,
        provider_message_id: null,
        status: "sent",
        sent_by_profile_id: authResult.profile.id,
      });
    } catch (error) {
      await database.from("incident_notifications").insert({
        incident_id: incidentId,
        recipient_email: profile.email,
        subject: `Actualizare incident ${existing.data.localOrderId}`,
        status: "failed",
        error_message: error instanceof Error ? error.message : "email_failed",
        sent_by_profile_id: authResult.profile.id,
      });
      return NextResponse.json({ error: "notification_send_failed" }, { status: 502 });
    }
  }

  if (
    body.resolutionStatus !== undefined ||
    body.refundStatus !== undefined ||
    body.customerNotificationStatus !== undefined ||
    body.internalNotes !== undefined
  ) {
    await database.from("audit_events").insert({
      actor_profile_id: authResult.profile.id,
      actor_role: "admin",
      action: "incident_updated",
      entity_type: "order",
      entity_id: existing.data.id,
      changes: body,
    });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      ok: true,
      order: mapRepoOrderToAdminOrder(existing.data),
    });
  }

  const updated = await orders.updateById(id, patch);
  if (!updated.ok) {
    console.error("[admin/orders] update failed:", updated.error);
    return NextResponse.json({ error: "Order update failed." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    order: mapRepoOrderToAdminOrder(updated.data),
  });
}
