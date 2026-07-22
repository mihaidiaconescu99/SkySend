"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Gauge, Zap } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { useSettings } from "@/lib/settings/settings-context";

const icons = [Gauge, Zap, CalendarClock] as const;

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
    primary: "Creează livrare",
    secondary: "Verifică acoperirea",
    plans: [
      { name: "Standard", description: "Pentru livrările de zi cu zi.", eta: "25–40 min" },
      { name: "Prioritară", description: "Când fiecare minut contează.", eta: "12–25 min" },
      { name: "Programată", description: "Alegi ziua și ora.", eta: "Interval ales" },
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
    primary: "Create delivery",
    secondary: "Check coverage",
    plans: [
      { name: "Standard", description: "For everyday deliveries.", eta: "25–40 min" },
      { name: "Priority", description: "When every minute matters.", eta: "12–25 min" },
      { name: "Scheduled", description: "Choose the day and time.", eta: "Chosen window" },
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
    </div>
  );
}
