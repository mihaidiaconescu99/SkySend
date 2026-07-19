import { SiteMessagesView } from "@/components/staff/site-messages-view";
import { createPageMetadata } from "@/lib/metadata";
export const metadata = createPageMetadata("Mesaje site", "Inboxul mesajelor publice SkySend.");
export default function AdminSiteMessagesPage() { return <SiteMessagesView />; }
