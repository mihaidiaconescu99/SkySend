"use client";

import { Download, ReceiptText } from "lucide-react";
import { PaymentsEmptyState } from "@/components/shared/domain-empty-states";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
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

function getStatusPresentation(status: BillingHistoryTransaction["status"]) {
  switch (status) {
    case "paid":
      return { label: "Aprobată", tone: "success" as const };
    case "failed":
      return { label: "Respinsă", tone: "destructive" as const };
    case "refunded":
      return { label: "Rambursată", tone: "warning" as const };
    default:
      return { label: "În procesare", tone: "info" as const };
  }
}

function InvoiceDownload({ transaction }: { transaction: BillingHistoryTransaction }) {
  if (!transaction.invoiceDownloadHref) {
    return <span aria-hidden="true" className="block size-9" />;
  }

  return (
    <a
      href={transaction.invoiceDownloadHref}
      aria-label={`Descarcă factura pentru tranzacția din ${formatDateTime(transaction.date)}`}
      title="Descarcă factura PDF"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition hover:border-primary/45 hover:text-primary focus-visible:ring-4 focus-visible:ring-ring"
    >
      <Download className="size-4" />
    </a>
  );
}

export function BillingHistoryView({ transactions }: BillingHistoryViewProps) {
  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Istoric plăți"
        title="Toate tranzacțiile, într-un singur loc."
        description="Plățile aprobate, respinse și rambursările sunt afișate în ordine cronologică inversă."
        actions={[
          {
            label: "Alege card salvat",
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
          title="Istoric plăți"
          description="Factura este disponibilă pentru tranzacțiile aprobate, după generarea documentului."
        >
          <div className="hidden overflow-hidden rounded-[var(--ui-radius-panel)] border border-border/70 expanded-ui:block">
            <table className="w-full">
              <thead className="bg-secondary/45 text-left">
                <tr className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-4">Dată</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Sumă</th>
                  <th className="px-5 py-4 text-right">Factură</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => {
                  const status = getStatusPresentation(transaction.status);

                  return (
                    <tr
                      key={transaction.id}
                      className={cn(
                        "border-t border-border/70 bg-card",
                        index === 0 && "border-t-0",
                      )}
                    >
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {formatDateTime(transaction.date)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge label={status.label} tone={status.tone} />
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-foreground">
                        {transaction.amountLabel}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <InvoiceDownload transaction={transaction} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 compact-ui:grid expanded-ui:hidden">
            {transactions.map((transaction) => {
              const status = getStatusPresentation(transaction.status);

              return (
                <Card key={transaction.id} className="rounded-[var(--ui-radius-card)]">
                  <CardContent className="grid grid-cols-[1fr_auto] gap-4 p-4">
                    <div className="grid gap-3">
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(transaction.date)}
                      </p>
                      <StatusBadge label={status.label} tone={status.tone} />
                      <p className="text-sm font-medium text-foreground">
                        {transaction.amountLabel}
                      </p>
                    </div>
                    <InvoiceDownload transaction={transaction} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </SectionCard>
      )}

      <div className="flex items-start gap-3 border-t border-border/70 pt-5 text-sm leading-6 text-muted-foreground">
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Factura PDF apare după generare și poate fi descărcată direct din tabel.</p>
      </div>
    </section>
  );
}
