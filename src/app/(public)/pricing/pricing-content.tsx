"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Gauge,
  PackageCheck,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { useSettings } from "@/lib/settings/settings-context";

const icons = [Gauge, Zap, CalendarClock] as const;
const surchargeIcons = [PackageCheck, Thermometer, PackageCheck, Wind] as const;

const content = {
  ro: {
    eyebrow: "Tarife",
    title: "Alegi ritmul. Vezi prețul înainte de plată.",
    description:
      "Estimarea finală se calculează după traseu și colet, înainte să confirmi.",
    from: "de la",
    eta: "Timp estimat",
    note:
      "Prețul final poate varia în funcție de distanță, colet și disponibilitate. Îl vezi înainte de confirmare.",
    surchargeEyebrow: "Cerințe speciale",
    surchargeTitle: "Taxe suplimentare, numai când sunt necesare.",
    surchargeDescription:
      "Unele colete au nevoie de pregătire suplimentară înainte de preluare. Orice ajustare este inclusă în estimarea afișată înainte de plată.",
    surchargeRange:
      "Pentru aceste cerințe, taxele suplimentare pot fi între 10 și 30 RON, în funcție de evaluarea coletului.",
    surcharges: [
      {
        title: "Greutate și dimensiune",
        description:
          "Verificăm capacitatea dronei și spațiul necesar pentru colete voluminoase sau mai grele.",
        price: null,
      },
      {
        title: "Sensibilitate la temperatură",
        description:
          "Pentru produse care au nevoie de protecție termică sau de o pregătire atentă la manipulare.",
        price: null,
      },
      {
        title: "Fragilitate",
        description:
          "Se aplică atunci când coletul necesită ambalare, fixare sau verificări suplimentare înainte de zbor.",
        price: null,
      },
      {
        title: "Vreme și vânt",
        description:
          "În condiții de vânt care cer măsuri operaționale suplimentare, se poate aplica o taxă fixă.",
        price: "+5 RON",
      },
    ],
    primary: "Creează livrare",
    secondary: "Verifică acoperirea",
    plans: [
      { name: "Standard", description: "Pentru livrările de zi cu zi.", eta: "6–10 min" },
      { name: "Prioritară", description: "Când fiecare minut contează.", eta: "4–8 min" },
      { name: "Programată", description: "Alegi ziua și ora.", eta: "6–10 min de la ora aleasă" },
    ],
  },
  en: {
    eyebrow: "Pricing",
    title: "Choose the pace. See the price before you pay.",
    description:
      "Your final estimate is calculated from the route and parcel before you confirm.",
    from: "from",
    eta: "Estimated time",
    note:
      "The final price may vary with distance, parcel and availability. You will see it before confirmation.",
    surchargeEyebrow: "Special handling",
    surchargeTitle: "Additional charges, only when needed.",
    surchargeDescription:
      "Some parcels need extra preparation before pickup. Any adjustment is included in the estimate shown before payment.",
    surchargeRange:
      "For these requirements, additional charges may range from 10 to 30 RON based on the parcel assessment.",
    surcharges: [
      {
        title: "Weight and size",
        description:
          "We check aircraft capacity and the space needed for heavier or bulkier parcels.",
        price: null,
      },
      {
        title: "Temperature sensitivity",
        description:
          "For items that need thermal protection or more careful handling before dispatch.",
        price: null,
      },
      {
        title: "Fragility",
        description:
          "Applied when a parcel needs extra packaging, securement or checks before flight.",
        price: null,
      },
      {
        title: "Weather and wind",
        description:
          "A fixed operational adjustment may apply when wind conditions require extra measures.",
        price: "+5 RON",
      },
    ],
    primary: "Create delivery",
    secondary: "Check coverage",
    plans: [
      { name: "Standard", description: "For everyday deliveries.", eta: "6–10 min" },
      { name: "Priority", description: "When every minute matters.", eta: "4–8 min" },
      { name: "Scheduled", description: "Choose the day and time.", eta: "6–10 min after the selected time" },
    ],
  },
} as const;

export default function PricingContent({
  startingPricesMinor,
}: {
  startingPricesMinor: readonly [number, number, number];
}) {
  const { language, formatCurrency } = useSettings();
  const copy = content[language];

  return (
    <div className="app-page-spacing mx-auto flex w-full max-w-7xl flex-col gap-12 md:gap-16">
      <header className="grid gap-7 border-b border-border/70 pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:pb-14">
        <div className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 font-heading text-4xl tracking-[-0.045em] text-foreground sm:text-5xl lg:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AppButton asChild size="lg">
            <Link href="/client/create-delivery">
              {copy.primary}<ArrowRight className="size-4" />
            </Link>
          </AppButton>
          <AppButton asChild variant="outline" size="lg">
            <Link href="/#coverage">{copy.secondary}</Link>
          </AppButton>
        </div>
      </header>

      <section className="grid gap-px overflow-hidden rounded-[var(--ui-radius-panel)] border border-border/70 bg-border/70 lg:grid-cols-3">
        {copy.plans.map((plan, index) => {
          const Icon = icons[index] ?? Gauge;
          return (
            <article key={plan.name} className="flex min-h-80 flex-col bg-background p-7 md:p-9">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-8 font-heading text-3xl tracking-tight">{plan.name}</h2>
              <p className="mt-3 text-base text-muted-foreground">{plan.description}</p>
              <div className="mt-auto pt-10">
                <p className="text-sm text-muted-foreground">{copy.from}</p>
                <p className="mt-1 font-heading text-4xl tracking-tight">
                  {formatCurrency(startingPricesMinor[index] ?? startingPricesMinor[0])}
                </p>
                <p className="mt-5 text-sm text-muted-foreground">
                  {copy.eta} · <span className="text-foreground">{plan.eta}</span>
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <p className="max-w-3xl border-l border-primary/60 pl-5 text-sm leading-7 text-muted-foreground">
        {copy.note}
      </p>

      <section className="border-y border-border/70">
        <div className="max-w-3xl px-1 py-8 md:py-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            {copy.surchargeEyebrow}
          </p>
          <h2 className="mt-3 font-heading text-3xl tracking-tight text-foreground md:text-4xl">
            {copy.surchargeTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
            {copy.surchargeDescription}
          </p>
        </div>
        <div className="grid border-t border-border/70 md:grid-cols-2">
          {copy.surcharges.map((surcharge, index) => {
            const Icon = surchargeIcons[index] ?? PackageCheck;

            return (
              <article
                key={surcharge.title}
                className="grid gap-4 border-b border-border/70 px-1 py-6 md:px-6 md:py-7 md:[&:nth-child(odd)]:border-r"
              >
                <div className="flex items-start justify-between gap-4">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  {surcharge.price ? (
                    <span className="text-sm font-medium text-foreground">
                      {surcharge.price}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{surcharge.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {surcharge.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="max-w-3xl px-1 py-6 text-sm leading-7 text-muted-foreground md:px-6">
          {copy.surchargeRange}
        </p>
      </section>
    </div>
  );
}
