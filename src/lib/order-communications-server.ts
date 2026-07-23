import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderCommunicationEmail } from "@/lib/email/resend";
import { getRecipientTrackingPath } from "@/lib/recipient-tracking";
import type { Database } from "@/types/database";
import type { Order } from "@/types/order";
import type { Profile } from "@/types/profile";
import { getR2Object } from "@/lib/storage/r2";

type Locale = "ro" | "en";
const db = (supabase: SupabaseClient<Database>) => supabase as any;

function money(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-GB", { style: "currency", currency }).format(amountMinor / 100);
}

async function addressFor(supabase: SupabaseClient<Database>, id: string) {
  const { data } = await db(supabase).from("addresses").select("formatted_address").eq("id", id).maybeSingle();
  return data?.formatted_address ?? "—";
}

export async function ensureOrderCommunication({
  supabase,
  order,
  profile,
  locale,
  origin,
  eventType = "confirmation",
}: {
  supabase: SupabaseClient<Database>;
  order: Order;
  profile: Profile;
  locale: Locale;
  origin: string;
  eventType?: "confirmation" | "scheduled_reminder";
}) {
  const database = db(supabase);
  await database.from("order_communication_events").upsert({
    order_id: order.id,
    profile_id: profile.id,
    event_type: eventType,
    locale,
  }, { onConflict: "order_id,event_type", ignoreDuplicates: true });
  const { data: event } = await database.from("order_communication_events")
    .select("*").eq("order_id", order.id).eq("event_type", eventType).single();
  if (!event) return { showPopups: false };

  const scheduled = order.dispatchTiming === "scheduled" && Boolean(order.scheduledAt);
  let firstInAppDelivery = false;
  let inAppCompletedAt: string | null = null;
  if (eventType === "confirmation" && !event.in_app_completed_at) {
    inAppCompletedAt = new Date().toISOString();
    const { data: inAppClaim } = await database.from("order_communication_events")
      .update({ in_app_completed_at: inAppCompletedAt })
      .eq("id", event.id)
      .is("in_app_completed_at", null)
      .select("id")
      .maybeSingle();
    firstInAppDelivery = Boolean(inAppClaim);
  }
  if (firstInAppDelivery) {
    const second = scheduled
      ? { title: locale === "ro" ? "Livrare programată" : "Delivery scheduled", message: locale === "ro" ? "Am rezervat data și ora alese." : "We reserved your chosen date and time.", action_url: "/client/orders?view=scheduled" }
      : { title: locale === "ro" ? "Livrarea este pregătită" : "Delivery is ready", message: locale === "ro" ? "Urmărirea este disponibilă în Livrare activă." : "Tracking is available in Active delivery.", action_url: "/client/active-delivery" };
    const { error: notificationError } = await database.from("notifications").insert([
      { profile_id: profile.id, title: locale === "ro" ? "Comandă plasată" : "Order placed", message: locale === "ro" ? "Plata a fost confirmată. Pregătim livrarea." : "Payment is confirmed. We are preparing your delivery.", type: "order", action_url: `/client/orders/${order.localOrderId}`, metadata: { communicationEventId: event.id } },
      { profile_id: profile.id, ...second, type: "mission", metadata: { communicationEventId: event.id } },
    ]);
    if (notificationError) {
      await database.from("order_communication_events").update({ in_app_completed_at: null }).eq("id", event.id).eq("in_app_completed_at", inAppCompletedAt);
      throw new Error(notificationError.message);
    }
  }

  if (event.email_status === "sent" || event.email_status === "skipped") return { showPopups: firstInAppDelivery };
  const emailEnabled = profile.notificationPreferences.email;
  if (!emailEnabled) {
    await database.from("order_communication_events").update({ email_status: "skipped" }).eq("id", event.id);
    return { showPopups: firstInAppDelivery };
  }
  let recipientEmail = profile.email;
  let invoiceAttachment: { filename: string; contentBase64: string } | null = null;
  let invoiceDownloadUrl: string | null = null;
  let invoicePending = false;
  if (eventType === "confirmation") {
    const [{ data: invoice }, { data: billing }] = await Promise.all([
      database.from("billing_documents").select("id,document_number,generation_status,pdf_object_key")
        .eq("order_id", order.id).eq("document_type", "invoice").maybeSingle(),
      database.from("order_billing_snapshots").select("invoice_email")
        .eq("order_id", order.id).maybeSingle(),
    ]);
    recipientEmail = billing?.invoice_email ?? profile.email;
    if (!invoice || ["pending", "generating", "retry_scheduled"].includes(invoice.generation_status)) {
      return { showPopups: firstInAppDelivery };
    }
    if (invoice.generation_status === "ready" && invoice.pdf_object_key) {
      const object = await getR2Object({ objectKey: invoice.pdf_object_key, maxBytes: 20 * 1024 * 1024 });
      invoiceAttachment = {
        filename: `${invoice.document_number}.pdf`,
        contentBase64: Buffer.from(object.bytes).toString("base64"),
      };
      invoiceDownloadUrl = new URL(`/api/billing/documents/${invoice.id}`, origin).toString();
    } else {
      invoicePending = true;
    }
  }
  const { data: claimed } = await database.from("order_communication_events")
    .update({ email_status: "sending", email_attempt_count: Number(event.email_attempt_count ?? 0) + 1, last_error: null })
    .eq("id", event.id).in("email_status", ["pending", "failed"]).select("id").maybeSingle();
  if (!claimed) return { showPopups: false };

  try {
    const pickup = await addressFor(supabase, order.pickupAddressId);
    const dropoff = await addressFor(supabase, order.dropoffAddressId);
    const trackingPath = getRecipientTrackingPath({ code: order.publicTrackingCode, token: order.recipientTrackingToken });
    const result = await sendOrderCommunicationEmail({
      event: eventType,
      to: recipientEmail,
      locale,
      orderId: order.localOrderId,
      total: money(order.totalAmountMinor, order.currency, locale),
      pickup,
      dropoff,
      scheduledAt: order.scheduledAt,
      trackingUrl: eventType === "confirmation" && !scheduled ? new URL(trackingPath, origin).toString() : null,
      invoiceAttachment,
      invoiceDownloadUrl,
      invoicePending,
      idempotencyKey: `skysend-${order.id}-${eventType}`,
    });
    await database.from("order_communication_events").update({
      email_status: result.skipped ? "skipped" : "sent",
      email_sent_at: result.skipped ? null : new Date().toISOString(),
      last_error: invoicePending ? "invoice_pending_at_confirmation" : null,
    }).eq("id", event.id);
    if (invoiceAttachment) {
      await database.from("billing_documents").update({
        delivery_status: result.skipped ? "skipped" : "sent",
        delivered_at: result.skipped ? null : new Date().toISOString(),
      }).eq("order_id", order.id).eq("document_type", "invoice");
    }
  } catch (error) {
    await database.from("order_communication_events").update({ email_status: "failed", last_error: error instanceof Error ? error.message.slice(0, 1000) : "unknown_error" }).eq("id", event.id);
  }
  return { showPopups: firstInAppDelivery };
}
