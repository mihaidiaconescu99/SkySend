import { SavedItemsView } from "@/components/dashboard/saved-items-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Locații salvate",
  "Gestionează punctele frecvente de ridicare și livrare pentru comenzile SkySend.",
);

export default function SavedPlacesPage() {
  return <SavedItemsView />;
}
