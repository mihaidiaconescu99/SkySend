import { AdminStatisticsView } from "@/components/admin/admin-statistics-view";
import { getAdminStatisticsSnapshotFromDB } from "@/lib/admin-data-server";
import { getAvailableExportFilterOptions } from "@/lib/admin-export";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Rapoarte",
  "Raport operațional și export CSV în Panoul Administrator.",
);

export default async function AdminStatisticsPage() {
  const snapshot = await getAdminStatisticsSnapshotFromDB();
  const exportOptions = getAvailableExportFilterOptions();

  return (
    <AdminStatisticsView
      initialSnapshot={snapshot}
      initialExportOptions={exportOptions}
    />
  );
}
