import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminRestrictedAccessState } from "@/components/admin/admin-restricted-access-state";
import { requireAdminRoute } from "@/lib/protected-routes";

export default async function AdminAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const context = await requireAdminRoute();

  if (!context.canAccessAdmin) {
    return <AdminRestrictedAccessState currentRole={context.role} />;
  }

  return <AdminShell canManageStaffAccess={context.isPermanentAdmin}>{children}</AdminShell>;
}
