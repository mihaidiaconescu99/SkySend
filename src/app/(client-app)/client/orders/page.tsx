import { ClientOrdersView } from "@/components/dashboard/client-orders-view";
import { createPageMetadata } from "@/lib/metadata";
import { getClientOrderSummaries } from "@/lib/client-orders";

export const metadata = createPageMetadata(
  "Client Comenzi",
  "Verifica istoricul comenzilor si livrarile programate.",
);

export default async function ClientOrdersPage() {
  const orders = await getClientOrderSummaries();

  return <ClientOrdersView orders={orders} />;
}
