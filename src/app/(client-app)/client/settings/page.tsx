import { ClientSettingsView } from "@/components/settings/client-settings-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Setări",
  "Gestionează contul SkySend și preferințele aplicației.",
);

export default function SettingsPage() {
  return <ClientSettingsView />;
}
