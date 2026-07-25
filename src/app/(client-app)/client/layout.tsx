import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRoleRoute } from "@/lib/protected-routes";

export default async function ClientAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const context = await requireRoleRoute("client");

  return (
    <DashboardShell role="client" accountRole={context.role ?? "client"}>
      {children}
    </DashboardShell>
  );
}
