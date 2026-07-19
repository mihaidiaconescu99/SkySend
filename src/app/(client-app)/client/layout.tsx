import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRoleRoute } from "@/lib/protected-routes";

export default async function ClientAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireRoleRoute("client");

  return <DashboardShell role="client">{children}</DashboardShell>;
}
