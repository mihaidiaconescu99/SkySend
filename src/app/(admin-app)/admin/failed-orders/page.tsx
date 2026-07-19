import { AdminFailedOrdersView } from "@/components/admin/admin-failed-orders-view";
import { getAdminFailedOrderDetailsFromDB } from "@/lib/admin-data-server";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Incidente",
  "Administrare livrări eșuate SkySend cu rezolvare, rambursare și audit.",
);

export default async function AdminFailedOrdersPage() {
  const orders = await getAdminFailedOrderDetailsFromDB();

  return <AdminFailedOrdersView initialOrders={orders} />;
}
