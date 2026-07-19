import { ParcelEvaluationsView } from "@/components/staff/parcel-evaluations-view";
import { createPageMetadata } from "@/lib/metadata";
export const metadata = createPageMetadata("Evaluări colete", "Cereri de evaluare trimise de clienți.");
export default function OperatorParcelEvaluationsPage() { return <ParcelEvaluationsView />; }
