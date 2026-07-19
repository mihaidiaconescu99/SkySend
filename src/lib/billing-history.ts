import "server-only";

import { auth } from "@clerk/nextjs/server";

import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BillingHistoryTransaction } from "@/types/billing-history";
import type { PaymentRecord } from "@/types/payment-record";

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

  return records.data.map((record) => ({
    id: record.id,
    orderId: record.orderId,
    date: record.createdAt,
    amountLabel: formatCurrency(record),
    paymentMethodLabel: record.stripePaymentIntentId
      ? "Stripe card"
      : "Metoda de plata in asteptare",
    paymentMethodDetail: record.stripePaymentIntentId ?? "Nicio referinta Stripe",
    status: mapStatus(record),
    receiptHref: `/client/orders/${record.orderId}`,
  }));
}
