import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createBillingR2ObjectKey, getR2Object, uploadR2Object } from "@/lib/storage/r2";
import { serverEnv } from "@/lib/env.server";
import type { BillingDocumentSummary, BillingSnapshotInput } from "@/types/billing";
import type { Database } from "@/types/database";
import type { Order, PricingSnapshot } from "@/types/order";
import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";
import { sendBillingDocumentEmail } from "@/lib/email/resend";

const db = (supabase: SupabaseClient<Database>) => supabase as any;

export async function findOwnedOrder(
  supabase: SupabaseClient<Database>,
  profileId: string,
  orderId: string,
) {
  const database = db(supabase);
  const { data, error } = await database.from("orders").select("*")
    .eq("sender_profile_id", profileId)
    .eq(getOrderIdentifierColumn(orderId), orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function saveBillingSnapshot(
  profileId: string,
  orderId: string,
  input: BillingSnapshotInput,
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
) {
  const database = db(supabase);
  const order = await findOwnedOrder(supabase, profileId, orderId);
  if (!order) throw new Error("order_not_found");
  if (order.payment_status !== "pending") throw new Error("billing_snapshot_locked");
  const payload = {
    order_id: order.id,
    customer_type: input.customerType,
    full_name: input.customerType === "individual" ? input.fullName?.trim() || null : null,
    company_legal_name: input.customerType === "company" ? input.companyLegalName?.trim() || null : null,
    tax_identifier: input.customerType === "company" ? input.taxIdentifier?.trim() || null : null,
    address_line: input.addressLine.trim(),
    city: input.city.trim(),
    region: input.region.trim(),
    country_code: input.countryCode.toUpperCase(),
    postal_code: input.postalCode?.trim() || null,
    invoice_email: input.invoiceEmail.trim().toLowerCase(),
    locale: input.locale,
    privacy_acknowledged_at: new Date().toISOString(),
  };
  const { data, error } = await database.from("order_billing_snapshots")
    .upsert(payload, { onConflict: "order_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBillingSnapshotForOrder(
  supabase: SupabaseClient<Database>,
  orderUuid: string,
) {
  const { data, error } = await db(supabase).from("order_billing_snapshots")
    .select("*").eq("order_id", orderUuid).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export function buildInvoiceLineItems(pricing: PricingSnapshot) {
  const items = [
    { code: "base_fee", nameRo: "Serviciu de livrare", nameEn: "Delivery service", amountMinor: pricing.baseFee },
    { code: "distance_fee", nameRo: "Cost distanță", nameEn: "Distance charge", amountMinor: pricing.distanceFee },
    { code: "dispatch_adjustment", nameRo: "Opțiune de livrare", nameEn: "Dispatch option", amountMinor: pricing.dispatchAdjustment },
    ...(pricing.scheduledAdjustment
      ? [{ code: "scheduled_adjustment", nameRo: "Livrare programată", nameEn: "Scheduled delivery", amountMinor: pricing.scheduledAdjustment }]
      : []),
    ...pricing.surcharges.map((item) => ({
      code: item.type,
      nameRo: item.label,
      nameEn: item.label,
      amountMinor: item.amount,
    })),
  ].filter((item) => item.amountMinor !== 0);
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0);
  if (total !== pricing.total) throw new Error("invoice_line_total_mismatch");
  return items;
}

export async function ensureInvoiceDocument(
  supabase: SupabaseClient<Database>,
  order: Order,
  paymentMethod: Record<string, unknown> = {},
) {
  const database = db(supabase);
  const snapshot = await getBillingSnapshotForOrder(supabase, order.id);
  if (!snapshot) throw new Error("billing_snapshot_missing");
  const { data: existing } = await database.from("billing_documents")
    .select("*").eq("order_id", order.id).eq("document_type", "invoice").maybeSingle();
  if (existing) return existing;
  const lineItems = buildInvoiceLineItems(order.pricingSnapshot);
  const { data, error } = await database.rpc("create_billing_document", {
    p_order_id: order.id,
    p_billing_snapshot_id: snapshot.id,
    p_document_type: "invoice",
    p_amount_minor: order.totalAmountMinor,
    p_currency: order.currency,
    p_line_items: lineItems,
    p_payment_method: paymentMethod,
  });
  if (error) {
    const { data: raced } = await database.from("billing_documents")
      .select("*").eq("order_id", order.id).eq("document_type", "invoice").maybeSingle();
    if (raced) return raced;
    throw new Error(error.message);
  }
  return Array.isArray(data) ? data[0] : data;
}

function issuerBlock() {
  return [
    serverEnv.INVOICE_ISSUER_LEGAL_NAME,
    serverEnv.INVOICE_ISSUER_ADDRESS,
    [serverEnv.INVOICE_ISSUER_POSTAL_CODE, serverEnv.INVOICE_ISSUER_CITY].filter(Boolean).join(" "),
    serverEnv.INVOICE_ISSUER_REGION,
    serverEnv.INVOICE_ISSUER_COUNTRY,
    serverEnv.INVOICE_ISSUER_TAX_ID ? `CIF: ${serverEnv.INVOICE_ISSUER_TAX_ID}` : "",
    serverEnv.INVOICE_ISSUER_EMAIL,
  ].filter(Boolean).join("\n");
}

function customerBlock(snapshot: any) {
  return [
    snapshot.customer_type === "company" ? snapshot.company_legal_name : snapshot.full_name,
    snapshot.tax_identifier ? `CIF: ${snapshot.tax_identifier}` : "",
    snapshot.address_line,
    [snapshot.postal_code, snapshot.city].filter(Boolean).join(" "),
    snapshot.region,
    snapshot.country_code,
    snapshot.invoice_email,
  ].filter(Boolean).join("\n");
}

async function generateDocumentPdf(document: any, snapshot: any, order: any) {
  if (!serverEnv.INVOICE_GENERATOR_API_KEY) throw new Error("invoice_provider_not_configured");
  const locale = snapshot.locale === "en" ? "en" : "ro";
  const lineItems = Array.isArray(document.line_items_snapshot) ? document.line_items_snapshot : [];
  const payload = {
    from: issuerBlock(),
    to: customerBlock(snapshot),
    logo: serverEnv.INVOICE_LOGO_URL || `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/icons/app-icon.svg`,
    number: document.document_number,
    currency: String(document.currency).toLowerCase(),
    date: new Date(document.issued_at).toISOString().slice(0, 10),
    payment_terms: locale === "ro" ? "Plătită prin Stripe" : "Paid via Stripe",
    amount_paid: document.amount_minor / 100,
    header: document.document_type === "invoice"
      ? (locale === "ro" ? "FACTURĂ" : "INVOICE")
      : (locale === "ro" ? "DOCUMENT DE CORECȚIE" : "CREDIT NOTE"),
    to_title: locale === "ro" ? "Facturat către" : "Bill to",
    invoice_number_title: locale === "ro" ? "Număr" : "Number",
    date_title: locale === "ro" ? "Data" : "Date",
    item_header: locale === "ro" ? "Serviciu" : "Service",
    quantity_header: locale === "ro" ? "Cantitate" : "Quantity",
    unit_cost_header: locale === "ro" ? "Tarif" : "Rate",
    amount_header: locale === "ro" ? "Valoare" : "Amount",
    subtotal_title: "Subtotal",
    total_title: "Total",
    amount_paid_title: locale === "ro" ? "Plătit" : "Amount paid",
    balance_title: locale === "ro" ? "Sold" : "Balance",
    notes_title: locale === "ro" ? "Detalii" : "Details",
    notes: document.document_type === "invoice"
      ? `${locale === "ro" ? "Comanda" : "Order"}: ${order.local_order_id}`
      : `${locale === "ro" ? "Corecție pentru factura" : "Correction for invoice"}: ${document.original_number ?? ""}\n${document.refund_reason ?? ""}`,
    items: lineItems.map((item: any) => ({
      name: locale === "ro" ? item.nameRo : item.nameEn,
      quantity: 1,
      unit_cost: item.amountMinor / 100,
    })),
  };
  const response = await fetch("https://invoice-generator.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.INVOICE_GENERATOR_API_KEY}`,
      "Content-Type": "application/json",
      "Accept-Language": locale === "ro" ? "en-US" : "en-US",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`invoice_provider_http_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") {
    throw new Error("invoice_provider_invalid_pdf");
  }
  return bytes;
}

const retryMinutes = [0, 5, 30] as const;

async function deliverGeneratedDocument(database: any, document: any, bytes: Uint8Array) {
  const confirmation = document.document_type === "invoice"
    ? await database.from("order_communication_events")
      .select("email_status,last_error")
      .eq("order_id", document.order_id)
      .eq("event_type", "confirmation")
      .maybeSingle()
    : { data: null };
  const needsSeparateEmail = document.document_type === "credit_note"
    || (confirmation.data?.email_status === "sent" && confirmation.data?.last_error === "invoice_pending_at_confirmation");
  if (!needsSeparateEmail) return;

  const preferences = document.order?.sender_profile_id
    ? await database.from("profiles").select("notification_preferences")
      .eq("id", document.order.sender_profile_id).maybeSingle()
    : { data: null };
  if (preferences.data?.notification_preferences?.email === false) {
    await database.from("billing_documents").update({ delivery_status: "skipped" }).eq("id", document.id);
    return;
  }
  const { data: claimed } = await database.from("billing_documents").update({
    delivery_status: "sending",
    delivery_attempt_count: Number(document.delivery_attempt_count ?? 0) + 1,
  }).eq("id", document.id).in("delivery_status", ["pending", "failed"]).select("id").maybeSingle();
  if (!claimed) return;
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    const result = await sendBillingDocumentEmail({
      to: document.snapshot.invoice_email,
      locale: document.snapshot.locale === "en" ? "en" : "ro",
      orderId: document.order.local_order_id,
      documentType: document.document_type,
      documentNumber: document.document_number,
      downloadUrl: new URL(`/api/billing/documents/${document.id}`, origin).toString(),
      attachment: {
        filename: `${document.document_number}.pdf`,
        contentBase64: Buffer.from(bytes).toString("base64"),
      },
      idempotencyKey: `skysend-billing-document-${document.id}`,
    });
    await database.from("billing_documents").update({
      delivery_status: result.skipped ? "skipped" : "sent",
      delivered_at: result.skipped ? null : new Date().toISOString(),
    }).eq("id", document.id);
  } catch (error) {
    await database.from("billing_documents").update({
      delivery_status: "failed",
      last_error_message: error instanceof Error ? error.message.slice(0, 300) : "document_email_failed",
    }).eq("id", document.id);
  }
}

export async function processDueBillingDocuments(
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
  now = new Date(),
) {
  const database = db(supabase);
  const { data: documents, error } = await database.from("billing_documents")
    .select("*,order:orders(*),snapshot:order_billing_snapshots(*),original:billing_documents!original_document_id(document_number)")
    .in("generation_status", ["pending", "retry_scheduled"])
    .lte("next_attempt_at", now.toISOString()).order("created_at").limit(10);
  if (error) throw new Error(error.message);
  let ready = 0;
  let failed = 0;
  for (const document of documents ?? []) {
    const nextAttempt = Number(document.attempt_count ?? 0) + 1;
    const { data: claimed } = await database.from("billing_documents")
      .update({ generation_status: "generating", attempt_count: nextAttempt, last_error_code: null, last_error_message: null })
      .eq("id", document.id).in("generation_status", ["pending", "retry_scheduled"]).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      document.original_number = document.original?.document_number ?? null;
      const bytes = await generateDocumentPdf(document, document.snapshot, document.order);
      const key = createBillingR2ObjectKey(document.order.sender_profile_id, document.order_id, document.document_number);
      await uploadR2Object({ objectKey: key, body: bytes, contentType: "application/pdf", retentionHours: null });
      await database.from("billing_documents").update({
        generation_status: "ready", pdf_object_key: key,
        generated_at: new Date().toISOString(), next_attempt_at: new Date().toISOString(),
      }).eq("id", document.id);
      await deliverGeneratedDocument(database, document, bytes);
      ready += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.slice(0, 300) : "pdf_generation_failed";
      const retry = nextAttempt < retryMinutes.length;
      const delay = retry ? retryMinutes[nextAttempt] : 0;
      await database.from("billing_documents").update({
        generation_status: retry ? "retry_scheduled" : "failed",
        next_attempt_at: new Date(Date.now() + delay * 60_000).toISOString(),
        last_error_code: message.split(":")[0], last_error_message: message,
      }).eq("id", document.id);
      failed += 1;
    }
  }
  const { data: deliveryFailures } = await database.from("billing_documents")
    .select("*,order:orders(*),snapshot:order_billing_snapshots(*)")
    .eq("generation_status", "ready")
    .eq("delivery_status", "failed")
    .not("pdf_object_key", "is", null)
    .order("updated_at")
    .limit(10);
  const { data: fallbackEvents } = await database.from("order_communication_events")
    .select("order_id")
    .eq("event_type", "confirmation")
    .eq("email_status", "sent")
    .eq("last_error", "invoice_pending_at_confirmation")
    .limit(10);
  const fallbackOrderIds = (fallbackEvents ?? []).map((event: any) => event.order_id);
  const { data: fallbackInvoices } = fallbackOrderIds.length
    ? await database.from("billing_documents")
      .select("*,order:orders(*),snapshot:order_billing_snapshots(*)")
      .eq("document_type", "invoice")
      .eq("generation_status", "ready")
      .in("delivery_status", ["pending", "failed"])
      .in("order_id", fallbackOrderIds)
    : { data: [] };
  const deliveryRetries = [
    ...(deliveryFailures ?? []),
    ...(fallbackInvoices ?? []),
  ].filter((document, index, values) => values.findIndex((candidate) => candidate.id === document.id) === index);
  for (const document of deliveryRetries) {
    try {
      const object = await getR2Object({ objectKey: document.pdf_object_key, maxBytes: 20 * 1024 * 1024 });
      await deliverGeneratedDocument(database, document, object.bytes);
    } catch (error) {
      await database.from("billing_documents").update({
        last_error_message: error instanceof Error ? error.message.slice(0, 300) : "document_email_retry_failed",
      }).eq("id", document.id);
    }
  }
  return { scanned: documents?.length ?? 0, ready, failed, deliveryRetried: deliveryRetries.length };
}

export async function listBillingDocumentsForOwnedOrder(
  profileId: string,
  orderId: string,
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
): Promise<BillingDocumentSummary[]> {
  const order = await findOwnedOrder(supabase, profileId, orderId);
  if (!order) throw new Error("order_not_found");
  const { data, error } = await db(supabase).from("billing_documents")
    .select("*").eq("order_id", order.id).order("issued_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((document: any) => ({
    id: document.id,
    type: document.document_type,
    number: document.document_number,
    amountMinor: document.amount_minor,
    currency: document.currency,
    issuedAt: document.issued_at,
    status: document.generation_status,
    refundKind: document.refund_kind ?? null,
    refundReason: document.refund_reason ?? null,
    downloadHref: document.generation_status === "ready"
      ? `/api/billing/documents/${document.id}` : null,
  }));
}
