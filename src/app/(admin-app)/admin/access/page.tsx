import { redirect } from "next/navigation";
import { StaffAccessAdminView } from "@/components/admin/staff-access-admin-view";
import { requirePermanentAdminAccess } from "@/lib/staff-access/server";

export default async function AdminAccessPage() {
  const result = await requirePermanentAdminAccess();
  if (!result.ok) redirect("/access-denied?reason=permanent-admin-required");
  return <StaffAccessAdminView />;
}
