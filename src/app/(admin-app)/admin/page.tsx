import { AdminOperationalCenterView } from "@/components/admin/admin-operational-center";
import { getAdminOperationalCenterDataFromDB } from "@/lib/admin-data-server";
import { createPageMetadata } from "@/lib/metadata";
import { requireAdminRoute } from "@/lib/protected-routes";

export const metadata = createPageMetadata(
  "Privire generală",
  "Cozi operaționale pentru comenzi, incidente, mesaje și statusul platformei în Panoul Administrator.",
);

export default async function AdminOverviewPage() {
  await requireAdminRoute();
  const data = await getAdminOperationalCenterDataFromDB();

  return <AdminOperationalCenterView initialData={data} />;
}
