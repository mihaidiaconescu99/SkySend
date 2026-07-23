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
        .select("id,order_id,generation_status")
        .eq("document_type", "invoice")
        .in("order_id", orderIds)
    : { data: [], error: null };

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  const invoiceDownloadHrefByOrderId = new Map<string, string>();
  for (const invoice of invoiceRows ?? []) {
    if (invoice.generation_status === "ready") {
      invoiceDownloadHrefByOrderId.set(
        invoice.order_id,
        `/api/billing/documents/${invoice.id}`,
      );
    }
  }

  return records.data.map((record) => ({
    id: record.id,
    orderId: record.orderId,
    date: record.createdAt,
    amountLabel: formatCurrency(record),
    status: mapStatus(record),
    invoiceDownloadHref:
      record.type === "payment"
        ? (invoiceDownloadHrefByOrderId.get(record.orderId) ?? null)
        : null,
  }));
}
