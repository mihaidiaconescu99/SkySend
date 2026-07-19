import { CreateDeliveryShell } from "@/components/delivery/create-delivery-shell";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Creează livrare",
  "Start a new SkySend delivery inside the active Pitesti service area with route, parcel, urgency, map and summary in one flow.",
);

export default function CreateDeliveryPage() {
  return <CreateDeliveryShell />;
}
