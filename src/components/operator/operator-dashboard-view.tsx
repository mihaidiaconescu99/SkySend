import Link from "next/link";
import { ArrowRight, ClipboardCheck, LifeBuoy, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const operatorDestinations = [
  {
    title: "Suport clienți",
    description: "Preia conversații, răspunde clienților și închide solicitările rezolvate.",
    href: "/operator/support",
    icon: LifeBuoy,
  },
  {
    title: "Evaluări colete",
    description: "Clarifică detaliile coletului și confirmă profilul pentru livrare.",
    href: "/operator/parcel-evaluations",
    icon: ClipboardCheck,
  },
  {
    title: "Mesaje de pe site",
    description: "Răspunde prin email mesajelor publice de suport și comerciale.",
    href: "/operator/site-messages",
    icon: Mail,
  },
] as const;

export function OperatorDashboardView() {
  return (
    <section id="overview" className="app-container grid gap-6 py-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Spațiu operator
        </p>
        <h1 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
          Centru de lucru
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Toate acțiunile de aici folosesc date persistente și păstrează un istoric auditabil.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {operatorDestinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <Card key={destination.href} className="h-full">
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                  <h2 className="font-heading text-xl text-foreground">{destination.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {destination.description}
                  </p>
                </div>
                <Link
                  href={destination.href}
                  className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  Deschide
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
