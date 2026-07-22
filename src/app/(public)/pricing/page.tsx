import PricingContent from "./pricing-content";
import { defaultOperationalSettings } from "@/lib/admin-data";
import { getAdminOperationalSettingsFromDB } from "@/lib/admin-data-server";
import { dispatchTimingPricingMultipliers } from "@/lib/pricing";
import { createLocalizedMetadata } from "@/lib/settings/metadata";

export const dynamic = "force-dynamic";

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

export default async function PricingPage() {
  const settings = await getAdminOperationalSettingsFromDB();
  const basePriceMinor =
    settings?.basePrice.amountMinor ?? defaultOperationalSettings.basePrice.amountMinor;

  const startingPricesMinor = [
    Math.round(basePriceMinor * dispatchTimingPricingMultipliers.standard),
    Math.round(basePriceMinor * dispatchTimingPricingMultipliers.priority),
    Math.round(basePriceMinor * dispatchTimingPricingMultipliers.scheduled),
  ] as const;

  return <PricingContent startingPricesMinor={startingPricesMinor} />;
}
