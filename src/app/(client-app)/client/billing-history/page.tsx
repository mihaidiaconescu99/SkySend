import { BillingHistoryView } from "@/components/billing/billing-history-view";
import { getBillingHistoryTransactions } from "@/lib/billing-history";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Billing History",
  "Verificare secure payment history and receipt actions for SkySend client deliveries.",
);

export default async function ClientBillingHistoryPage() {
  const transactions = await getBillingHistoryTransactions();

  return <BillingHistoryView transactions={transactions} />;
}
