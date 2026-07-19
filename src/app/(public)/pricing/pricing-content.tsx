"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Gauge, Zap } from "lucide-react";
import { PublicSection } from "@/components/layout/public-section";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/lib/settings/settings-context";
import { getPublicCopy } from "@/lib/i18n/public-copy";

const PRICING_ICONS = [Gauge, Zap, CalendarClock] as const;

export default function PricingContent() {
  const { language, formatCurrency } = useSettings();
  const copy = getPublicCopy(language);

  return (
    <div className="app-page-spacing flex flex-col gap-10 md:gap-14">
      <section id="pricing-overview" className="scroll-mt-28">
        <div className="flex flex-col gap-6">
          <PageHeader
            eyebrow={copy.pricing.eyebrow}
            title={copy.pricing.title}
            description={copy.pricing.description}
            actions={[
              {
                label: copy.pricing.actions.primary,
                href: "/client/create-delivery",
                variant: "default",
                icon: <ArrowRight className="size-4" />,
              },
              {
                label: copy.pricing.actions.secondary,
                href: "/#coverage",
                variant: "outline",
              },
            ]}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {copy.pricing.signals.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                hint={item.hint}
              />
            ))}
          </div>
        </div>
      </section>

      <PublicSection
        id="delivery-types"
        eyebrow={language === "ro" ? "Tipuri de livrare" : "Delivery types"}
        title={
          language === "ro"
            ? "Trei moduri clare de livrare pentru serviciul curent."
            : "Three clear delivery modes for the current service."
        }
        description={
          language === "ro"
            ? "Modelul de tarifare rămâne ușor de înțeles: alegi modul de livrare, apoi verifici estimarea în fluxul comenzii."
            : "The pricing model stays easy to follow: pick the delivery mode, then check the estimate in the order flow."
        }
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {copy.pricing.plans.map((plan, index) => {
            const Icon = PRICING_ICONS[index] ?? Gauge;
            const basePrice = formatCurrency(plan.basePriceMinor);

            return (
              <Card
                key={plan.name}
                className="rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]"
              >
                <CardHeader className="gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl border border-border/80 bg-secondary/45 text-foreground">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <p className="text-sm leading-7 text-muted-foreground">
                    {plan.description}
                  </p>

                  <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "ro" ? "Timp estimat" : "Estimated time"}
                      </p>
                      <p className="mt-2 font-heading text-2xl tracking-tight">
                        {plan.eta}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === "ro" ? "Logică tarifare" : "Pricing logic"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {plan.pricing.replace("{price}", basePrice)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm leading-7 text-foreground">
                    {plan.highlight}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PublicSection>

      <PublicSection
        id="pricing-factors"
        eyebrow={language === "ro" ? "Factori tarifare" : "Pricing factors"}
        title={
          language === "ro"
            ? "Estimarea finală depinde de câteva date vizibile."
            : "The final estimate depends on a few visible data points."
        }
        description={
          language === "ro"
            ? "SkySend evită limbajul complicat de tarifare. Fluxul comenzii arată simplu cum se poate modifica estimarea înainte de confirmare."
            : "SkySend avoids complicated pricing language. The order flow shows plainly how the estimate can change before confirmation."
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.95fr)]">
          <SectionCard
            title={
              language === "ro"
                ? "Ce poate schimba prețul final"
                : "What can change the final price"
            }
            description={
              language === "ro"
                ? "Estimarea nu este finală până când traseul și profilul coletului sunt confirmate."
                : "The estimate isn't final until the route and parcel profile are confirmed."
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {copy.pricing.factors.map((factor) => (
                <div
                  key={factor.title}
                  className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5"
                >
                  <h2 className="font-heading text-lg tracking-tight">
                    {factor.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {factor.body}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <Card className="rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
            <CardContent className="grid gap-5 p-6 md:p-8">
              <div className="space-y-3">
                <h2 className="type-h2">{copy.pricing.noteTitle}</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {copy.pricing.noteBody}
                </p>
              </div>

              <div className="grid gap-3">
                {copy.pricing.bullets.map((item) => (
                  <div
                    key={item}
                    className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm leading-7 text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicSection>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] lg:items-stretch">
        <Card className="h-full rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
          <CardContent className="flex h-full flex-col justify-between gap-6 p-6 md:p-8">
            <div className="space-y-3">
              <h2 className="font-heading text-3xl tracking-tight text-foreground md:text-4xl">
                {copy.pricing.finalTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {copy.pricing.finalBody}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <AppButton asChild size="lg">
                <Link href="/client/create-delivery">{copy.pricing.finalPrimary}</Link>
              </AppButton>
              <AppButton asChild variant="outline" size="lg">
                <Link href="/how-it-works">{copy.pricing.finalSecondary}</Link>
              </AppButton>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
          <CardContent className="flex h-full flex-col justify-center gap-4 p-6 md:p-8">
            <p className="text-sm text-muted-foreground">{copy.pricing.scopeLabel}</p>
            <p className="font-heading text-2xl tracking-tight md:text-3xl">
              {copy.pricing.scopeHeading}
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {copy.pricing.scopeBody}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}