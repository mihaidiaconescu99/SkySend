import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminRoute } from "@/lib/protected-routes";

export default async function AdminAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireAdminRoute();

  return <AdminShell>{children}</AdminShell>;
}
