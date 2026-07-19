import { PaymentMethodsView } from "@/components/billing/payment-methods-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Metode de plată",
  "Manage saved card payment methods for the SkySend client dashboard.",
);

export default function ClientPaymentMethodsPage() {
  return <PaymentMethodsView />;
}
