import Link from "next/link";
import { ArrowRight, LifeBuoy, RefreshCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AppButton } from "@/components/shared/app-button";
import { createPageMetadata } from "@/lib/metadata";
import { getClientFailedOrderSummaries } from "@/lib/client-orders";

export const metadata = createPageMetadata(
  "Comenzi eșuate",
  "Verificare pentru livrările client eșuate din Pitești, cu motive clare, fallback vizibil și pași următori.",
);

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ClientFailedOrdersPage() {
  const failedOrders = await getClientFailedOrderSummaries();
  const paymentIssueCount = failedOrders.filter(
    (order) => order.paymentIssueLabel,
  ).length;

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Comenzi eșuate"
        title="Excepții de livrare clare, cu pași următori."
        description="Această pagină separă livrările eșuate de lista generală de comenzi, ca să fie clar ce s-a întâmplat, ce fallback s-a încercat și ce acțiune urmează."
        actions={[
          {
            label: "Toate comenzile",
            href: "/client/orders",
            variant: "outline",
          },
          {
            label: "Creează livrare",
            href: "/client/create-delivery",
            variant: "default",
            icon: <ArrowRight className="size-4" />,
          },
        ]}
      />

      {failedOrders.length === 0 ? (
        <EmptyState
          title="Nu există livrări eșuate acum"
          description="Zona pentru comenzi eșuate rămâne disponibilă pentru transparență, dar istoricul curent nu include misiuni eșuate nerezolvate."
          icon={<TriangleAlert className="size-6" />}
          primaryAction={{ label: "Înapoi la comenzi", href: "/client/orders" }}
          secondaryAction={{ label: "Creează livrare", href: "/client/create-delivery" }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-[calc(var(--radius)+0.5rem)]">
              <CardContent className="grid gap-3 p-6">
                <p className="text-sm text-muted-foreground">Comenzi eșuate vizibile</p>
                <p className="font-heading text-3xl tracking-tight">
                  {failedOrders.length}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Fiecare element rămâne vizibil aici până când clientul decide pasul următor.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-[calc(var(--radius)+0.5rem)]">
              <CardContent className="grid gap-3 p-6">
                <p className="text-sm text-muted-foreground">Verificare fallback</p>
                <p className="font-heading text-3xl tracking-tight">
                  {
                    failedOrders.filter((order) => order.fallbackUsed).length
                  }
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Comenzi pentru care s-a încercat o rută alternativă sau o verificare de recuperare.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-[calc(var(--radius)+0.5rem)]">
              <CardContent className="grid gap-3 p-6">
                <p className="text-sm text-muted-foreground">Probleme de plată</p>
                <p className="font-heading text-3xl tracking-tight">
                  {paymentIssueCount}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Comenzile eșuate pot afișa contextul plății fără să transforme pagina într-o consolă de billing.
                </p>
              </CardContent>
            </Card>
          </div>

          <SectionCard
            eyebrow="Coadă verificare"
            title="Comenzi eșuate cu context și opțiuni de recuperare"
            description="Scopul este să explicăm clar problema și să păstrăm o acțiune utilă la îndemână."
          >
            <div className="grid gap-4">
              {failedOrders.map((order) => (
                <Card
                  key={order.id}
                  className="rounded-[calc(var(--radius)+0.5rem)] shadow-[var(--elevation-card)]"
                >
                  <CardContent className="grid gap-5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{order.id}</Badge>
                          <StatusBadge label="Eșuată" tone="warning" />
                          {order.paymentIssueLabel ? (
                            <StatusBadge label="Problemă plată" tone="destructive" />
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Înregistrată la {formatDateTime(order.createdAt)}
                        </p>
                      </div>

                      <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/45 px-4 py-3 text-sm text-muted-foreground">
                        Cost estimat:{" "}
                        <span className="font-medium text-foreground">
                          {order.estimatedCostLabel}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                        <p className="text-sm text-muted-foreground">Rezumat traseu</p>
                        <p className="mt-2 text-sm leading-7 text-foreground">
                          {order.pickupArea} către {order.dropoffArea}
                        </p>
                      </div>

                      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4">
                        <p className="text-sm text-muted-foreground">Fallback</p>
                        <div className="mt-2">
                          <StatusBadge
                            label={order.fallbackLabel}
                            tone={order.fallbackUsed ? "info" : "neutral"}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                        <p className="text-sm text-muted-foreground">Motiv eșec</p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {order.failureReason}
                      </p>
                    </div>

                    {order.paymentIssueLabel ? (
                      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-destructive/20 bg-destructive/5 p-4">
                        <p className="text-sm text-muted-foreground">
                          Problemă de plată
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          {order.paymentIssueLabel}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <AppButton asChild>
                        <Link href="/client/create-delivery">
                          <RefreshCcw className="size-4" />
                          Reîncearcă livrarea
                        </Link>
                      </AppButton>
                      <AppButton asChild variant="outline">
                        <Link href={order.href}>Vezi detalii</Link>
                      </AppButton>
                      <AppButton asChild variant="ghost">
                        <Link href="/contact">
                          <LifeBuoy className="size-4" />
                          Contactează suportul
                        </Link>
                      </AppButton>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </section>
  );
}
