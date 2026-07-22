import { ClientSettingsView } from "@/components/settings/client-settings-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Cont",
  "Gestionează profilul, securitatea și preferințele SkySend.",
);

export default function SettingsPage() {
  return <ClientSettingsView />;
}
