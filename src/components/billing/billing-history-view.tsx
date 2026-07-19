"use client";

import Link from "next/link";
import { ArrowRight, ReceiptText, Search } from "lucide-react";
import { PaymentsEmptyState } from "@/components/shared/domain-empty-states";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppButton } from "@/components/shared/app-button";
import { Card, CardContent } from "@/components/ui/card";
import { paymentStatusLabels } from "@/constants/domain";
import { cn } from "@/lib/utils";
import type { BillingHistoryTransaction } from "@/types/billing-history";

type BillingHistoryViewProps = {
  transactions: BillingHistoryTransaction[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusTone(status: BillingHistoryTransaction["status"]) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "pending":
      return "info" as const;
    case "failed":
      return "destructive" as const;
    case "refunded":
      return "warning" as const;
  }
}

export function BillingHistoryView({
  transactions,
}: BillingHistoryViewProps) {
  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Istoric plăți"
        title="Activitate de payment pentru deliveriesle SkySend."
        description="Un istoric clar al plăților cu cardul, legat de comanda care a generat fiecare eveniment de payment."
        actions={[
          {
            label: "Metode de payment",
            href: "/client/payment-methods",
            variant: "outline",
          },
        ]}
      />

      {transactions.length === 0 ? (
        <PaymentsEmptyState />
      ) : (
        <SectionCard
          eyebrow="Tranzacții"
          title={`${transactions.length} eveniment de payment${transactions.length === 1 ? "" : "s"}`}
          description="Pe desktop se use un tabel compact. Pe mobil, același istoric apare în carduri lizibile cu acces la chitanț?."
        >
          <div className="hidden overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/80 lg:block">
            <table>
              <thead className="bg-secondary/45 text-left">
                <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-4">Plată</th>
                  <th className="px-4 py-4">Comandă</th>
                  <th className="px-4 py-4">Dată</th>
                  <th className="px-4 py-4">Sumă</th>
                  <th className="px-4 py-4">Method</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Chitanț?</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr
                    key={transaction.id}
                    className={cn(
                      "border-t border-border/80 bg-card",
                      index === 0 && "border-t-0",
                    )}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {transaction.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tranzacșie securizat? cu cardul
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm font-medium text-foreground">
                      {transaction.orderId}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      {formatDateTime(transaction.date)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm font-medium text-foreground">
                      {transaction.amountLabel}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          {transaction.paymentMethodLabel}
                        </p>
                        <p className="text-muted-foreground">
                          {transaction.paymentMethodDetail}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={paymentStatusLabels[transaction.status]}
                        tone={getStatusTone(transaction.status)}
                      />
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <AppButton asChild variant="ghost" size="sm">
                        <Link href={transaction.receiptHref}>
                          Chitanț?
                          <ArrowRight className="size-4" />
                        </Link>
                      </AppButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {transactions.map((transaction) => (
              <Card
                key={transaction.id}
                className="rounded-[calc(var(--radius)+0.5rem)]"
              >
                <CardContent className="grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {transaction.id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(transaction.date)}
                      </p>
                    </div>
                    <StatusBadge
                      label={paymentStatusLabels[transaction.status]}
                      tone={getStatusTone(transaction.status)}
                    />
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/45 px-4 py-3">
                      <p className="text-muted-foreground">Comandă</p>
                      <p className="mt-1 font-medium text-foreground">
                        {transaction.orderId}
                      </p>
                    </div>
                    <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/45 px-4 py-3">
                      <p className="text-muted-foreground">Method de payment</p>
                      <p className="mt-1 font-medium text-foreground">
                        {transaction.paymentMethodLabel}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {transaction.paymentMethodDetail}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-background px-4 py-3">
                      <p className="text-sm text-muted-foreground">Sumă</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {transaction.amountLabel}
                      </p>
                    </div>
                    <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-background px-4 py-3">
                      <p className="text-sm text-muted-foreground">Chitanț?</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        Chitanț? available
                      </p>
                    </div>
                  </div>

                  <AppButton asChild variant="outline" size="lg">
                    <Link href={transaction.receiptHref}>
                      Deschide chitanța
                      <Search className="size-4" />
                    </Link>
                  </AppButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionCard>
      )}

      <Card className="rounded-[calc(var(--radius)+0.75rem)]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <ReceiptText className="size-4" />
            </span>
            <div className="grid gap-1">
              <p className="font-medium text-foreground">History de plăți securizat</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Chitanț?s are linked to the card payment associated with each
                delivery order.
              </p>
            </div>
          </div>
          <StatusBadge label="Plăți cu cardul" tone="info" />
        </CardContent>
      </Card>
    </section>
  );
}

