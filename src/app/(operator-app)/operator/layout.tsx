import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireSupportOperatorRoute } from "@/lib/protected-routes";

export default async function OperatorAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireSupportOperatorRoute();

  return <DashboardShell role="operator">{children}</DashboardShell>;
}
