import { ClientSupportView } from "@/components/client/client-support-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Suport", "Conversațiile tale cu suportul SkySend.");
export default function ClientSupportPage() { return <ClientSupportView />; }
