import { OperatorDashboardView } from "@/components/operator/operator-dashboard-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Centru operator",
  "Suport clienți, evaluări de colete și mesaje primite de pe site.",
);

export default function OperatorDashboardPage() {
  return <OperatorDashboardView />;
}
