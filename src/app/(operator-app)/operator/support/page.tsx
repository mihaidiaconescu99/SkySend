import { OperatorSupportView } from "@/components/operator/operator-support-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Panou Operatori", "Coada unificată pentru solicitări de suport SkySend.");

export default function OperatorSupportPage() {
  return <OperatorSupportView />;
}
