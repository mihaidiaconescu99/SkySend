import { AdminOrdersView } from "@/components/admin/admin-orders-view";
import { getAdminOrdersFromDB } from "@/lib/admin-data-server";
import { createPageMetadata } from "@/lib/metadata";
import { requireAdminRoute } from "@/lib/protected-routes";

export const metadata = createPageMetadata(
  "Comenzi",
  "Administrare comenzi SkySend cu editare controlată și audit intern.",
);

export default async function AdminOrdersPage() {
  await requireAdminRoute();
  const orders = await getAdminOrdersFromDB();

  return <AdminOrdersView initialOrders={orders} />;
}
