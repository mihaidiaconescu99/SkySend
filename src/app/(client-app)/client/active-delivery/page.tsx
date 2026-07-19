import { ActiveDeliveryView } from "@/components/dashboard/active-delivery-view";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Activ delivery",
  "Deschide the current SkySend delivery tracking workspace.",
);

export default function ActiveDeliveryPage() {
  return <ActiveDeliveryView />;
}
