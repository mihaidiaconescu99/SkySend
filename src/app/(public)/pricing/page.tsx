import PricingContent from "./pricing-content";
import { createLocalizedMetadata } from "@/lib/settings/metadata";

export async function generateMetadata() {
  return createLocalizedMetadata({
    ro: {
      title: "Tarife",
      description:
        "Vezi modelul curent de tarifare pentru livrări standard, prioritare și programate cu drona în Pitești.",
    },
    en: {
      title: "Pricing",
      description:
        "See the current pricing model for standard, priority and scheduled drone deliveries in Pitești.",
    },
  });
}

export default function PricingPage() {
  return <PricingContent />;
}