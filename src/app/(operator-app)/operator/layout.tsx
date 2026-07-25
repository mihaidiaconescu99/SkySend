import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireSupportOperatorRoute } from "@/lib/protected-routes";

export default async function OperatorAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const context = await requireSupportOperatorRoute();

  return (
    <DashboardShell role="operator" accountRole={context.role ?? "operator"}>
      {children}
    </DashboardShell>
  );
}
