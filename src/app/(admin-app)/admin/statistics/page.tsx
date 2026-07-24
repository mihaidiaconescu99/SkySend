import { AdminStatisticsView } from "@/components/admin/admin-statistics-view";
import { getAdminStatisticsSnapshotFromDB } from "@/lib/admin-data-server";
import { getAvailableExportFilterOptions } from "@/lib/admin-export";
import { createPageMetadata } from "@/lib/metadata";
import { requireAdminRoute } from "@/lib/protected-routes";

export const metadata = createPageMetadata(
  "Rapoarte",
  "Raport operațional și export CSV în Panoul Administrator.",
);

export default async function AdminStatisticsPage() {
  await requireAdminRoute();
  const snapshot = await getAdminStatisticsSnapshotFromDB();
  const exportOptions = getAvailableExportFilterOptions();

  return (
    <AdminStatisticsView
      initialSnapshot={snapshot}
      initialExportOptions={exportOptions}
    />
  );
}
