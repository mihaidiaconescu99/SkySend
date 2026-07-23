import { BillingHistoryView } from "@/components/billing/billing-history-view";
import { getBillingHistoryTransactions } from "@/lib/billing-history";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Istoric plăți",
  "Toate plățile SkySend, statusurile lor și facturile disponibile.",
);

export default async function ClientBillingHistoryPage() {
  const transactions = await getBillingHistoryTransactions();

  return <BillingHistoryView transactions={transactions} />;
}
