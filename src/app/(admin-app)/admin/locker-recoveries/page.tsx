import { AdminLockerRecoveriesView } from "@/components/admin/admin-locker-recoveries-view";
import { getAdminLockerRecoveryDetailsFromDB } from "@/lib/admin-data-server";
import { createPageMetadata } from "@/lib/metadata";
import { requireAdminRoute } from "@/lib/protected-routes";

export const metadata = createPageMetadata(
  "Recuperare locker",
  "Incidente urgente în care lockerul rămâne pe teren și trebuie recuperat fizic.",
);

export default async function AdminLockerRecoveriesPage() {
  await requireAdminRoute();
  const recoveries = await getAdminLockerRecoveryDetailsFromDB();

  return <AdminLockerRecoveriesView initialRecoveries={recoveries} />;
}
