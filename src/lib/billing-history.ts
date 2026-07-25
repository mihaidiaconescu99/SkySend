import "server-only";

import { auth } from "@clerk/nextjs/server";

import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BillingHistoryTransaction } from "@/types/billing-history";
import type { PaymentRecord } from "@/types/payment-record";

type InvoiceDocumentRow = {
  id: string;
  order_id: string;
  generation_status: string;
  document_type: "invoice" | "credit_note";
  payment_method_snapshot: {
    brand?: string | null;
    last4?: string | null;
  } | null;
};

type BillingDocumentsQuery = {
  from: (table: "billing_documents") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<{
          data: InvoiceDocumentRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

function formatCurrency(record: PaymentRecord) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: record.currency,
    maximumFractionDigits: 2,
  }).format(record.amountMinor / 100);
}

function mapStatus(record: PaymentRecord): BillingHistoryTransaction["status"] {
  if (record.status === "succeeded") {
    return record.type === "payment" ? "paid" : "refunded";
  }

  return record.status === "failed" ? "failed" : "pending";
}

export async function getBillingHistoryTransactions(): Promise<
  BillingHistoryTransaction[]
> {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return [];
  }

  const records = await new PaymentRecordsRepository(supabase).listByProfileId(
    profile.data.id,
    { limit: 100 },
  );

  if (!records.ok) {
    throw new Error(records.error.message);
  }

  const orderIds = [...new Set(records.data.map((record) => record.orderId))];
  const billingDocuments = supabase as unknown as BillingDocumentsQuery;
  const { data: invoiceRows, error: invoiceError } = orderIds.length
    ? await billingDocuments
        .from("billing_documents")
        .select("id,order_id,generation_status,document_type,payment_method_snapshot")
        .eq("generation_status", "ready")
        .in("order_id", orderIds)
    : { data: [], error: null };

  if (invoiceError) {
    console.error("[billing-history] invoice documents unavailable", invoiceError);
  }

  const documentByOrderAndType = new Map<
    string,
    { href: string; methodKey: string | null; methodLabel: string | null }
  >();
  for (const invoice of invoiceRows ?? []) {
    if (invoice.generation_status === "ready") {
      const brand = invoice.payment_method_snapshot?.brand?.trim();
      const last4 = invoice.payment_method_snapshot?.last4?.trim();
      documentByOrderAndType.set(`${invoice.order_id}:${invoice.document_type}`, {
        href: `/api/billing/documents/${invoice.id}`,
        methodKey: brand && last4 ? `${brand}:${last4}` : null,
        methodLabel:
          brand && last4
            ? `${brand.slice(0, 1).toUpperCase()}${brand.slice(1)} •••• ${last4}`
            : null,
      });
    }
  }

  return records.data.map((record) => {
    const documentType = record.type === "payment" ? "invoice" : "credit_note";
    const document = documentByOrderAndType.get(`${record.orderId}:${documentType}`);
    const method =
      document ?? documentByOrderAndType.get(`${record.orderId}:invoice`);
    return {
      id: record.id,
      orderId: record.orderId,
      date: record.createdAt,
      amountLabel: formatCurrency(record),
      status: mapStatus(record),
      invoiceDownloadHref: document?.href ?? null,
      documentLabel:
        record.type === "payment" ? ("Factură" as const) : ("Notă de credit" as const),
      paymentMethodKey: method?.methodKey ?? null,
      paymentMethodLabel: method?.methodLabel ?? null,
    };
  });
}
