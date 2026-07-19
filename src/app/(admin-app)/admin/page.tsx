import { AdminOperationalCenterView } from "@/components/admin/admin-operational-center";
import { getAdminOperationalCenterDataFromDB } from "@/lib/admin-data-server";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Privire generală",
  "Cozi operaționale pentru comenzi, incidente, mesaje și statusul platformei în Panoul Administrator.",
);

export default async function AdminOverviewPage() {
  const data = await getAdminOperationalCenterDataFromDB();

  return <AdminOperationalCenterView initialData={data} />;
}
