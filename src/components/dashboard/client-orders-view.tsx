"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock3, PackageX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { AppButton } from "@/components/shared/app-button";
import { RepeatDeliveryButton } from "@/components/delivery/repeat-delivery-button";
import { orderStatusLabels } from "@/constants/domain";
import { formatDeliveryUrgency } from "@/lib/orders";
import type { ClientOrderSummary } from "@/types/client-orders";

type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";
type OrdersTab = "completed" | "scheduled";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isFutureScheduledOrder(order: ClientOrderSummary) {
  return (
    order.statusFilter === "scheduled" &&
    Boolean(order.scheduledFor) &&
    Date.parse(order.scheduledFor ?? "") > Date.now()
  );
}

function getScheduledDateLabel(order: ClientOrderSummary) {
  return order.scheduledFor
    ? formatDateTime(order.scheduledFor)
    : "Data nu este setată";
}

function getStatusLabel(order: ClientOrderSummary) {
  if (isFutureScheduledOrder(order)) {
    return "Nelivrată încă";
  }

  if (order.statusFilter === "active") {
    return "Activ";
  }

  switch (order.statusFilter) {
    case "completed":
      return "Finalizată";
    case "failed":
      return "Eșuată";
    case "scheduled":
      return "Programată";
    case "cancelled":
      return "Anulată";
    default:
      return orderStatusLabels[order.status];
  }
}

function getStatusTone(order: ClientOrderSummary): StatusTone {
  if (isFutureScheduledOrder(order)) {
    return "warning";
  }

  switch (order.statusFilter) {
    case "completed":
      return "success";
    case "failed":
      return "destructive";
    case "scheduled":
      return "warning";
    case "cancelled":
      return "neutral";
    case "active":
      return "info";
    default:
      return "neutral";
  }
}

function getPaymentTone(
  status: ClientOrderSummary["payment"]["status"],
): StatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "failed":
      return "destructive";
    case "refunded":
      return "warning";
    case "unpaid":
      return "warning";
    case "processing":
    case "pending":
      return "info";
  }
}

function ScheduledOrdersEmptyState() {
  return (
    <div className="grid place-items-center rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-secondary/25 px-5 py-10 text-center">
      <div className="relative mb-5 grid size-24 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
        <span className="absolute inset-3 rounded-full border border-primary/15" />
        <Clock3 className="size-10" />
      </div>
      <h3 className="font-heading text-xl tracking-tight text-foreground">
        Nu ai deocamdată nicio livrare programată
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Când alegi opțiunea programată la o livrare nouă, comanda va apărea aici cu data și ora setate.
      </p>
    </div>
  );
}

function CompletedOrdersEmptyState() {
  return (
    <div className="grid place-items-center rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-secondary/25 px-5 py-10 text-center">
      <div className="relative mb-5 grid size-24 place-items-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive">
        <span className="absolute right-4 top-4 grid size-6 place-items-center rounded-full border border-destructive/35 bg-background text-xs font-semibold">
          x
        </span>
        <PackageX className="size-10" />
      </div>
      <h3 className="font-heading text-xl tracking-tight text-foreground">
        Ne pare rău, dar nu ai comenzi înregistrate
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Când creezi o livrare nouă, comanda salvată în baza de date va apărea aici.
      </p>
    </div>
  );
}

function OrderActions({ order }: { order: ClientOrderSummary }) {
  return (
    <div className="flex justify-end gap-2">
      {order.runtimeOrder ? (
        <RepeatDeliveryButton order={order.runtimeOrder} variant="ghost" />
      ) : null}
      <AppButton asChild variant="ghost" size="sm">
        <Link href={order.href}>
          Vezi detalii
          <ArrowRight className="size-4" />
        </Link>
      </AppButton>
    </div>
  );
}

function OrderListSection({
  title,
  description,
  orders,
  scheduledSection = false,
}: {
  title: string;
  description: string;
  orders: ClientOrderSummary[];
  scheduledSection?: boolean;
}) {
  return (
    <SectionCard title={title} description={description}>
      {orders.length === 0 ? (
        scheduledSection ? (
          <ScheduledOrdersEmptyState />
        ) : (
          <CompletedOrdersEmptyState />
        )
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/80 expanded-ui:block">
            <table>
              <thead className="bg-secondary/45 text-left">
                <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-4">Comanda</th>
                  {!scheduledSection ? <th className="px-4 py-4">Traseu</th> : null}
                  <th className="px-4 py-4">Status</th>
                  {!scheduledSection ? <th className="px-4 py-4">Plată</th> : null}
                  <th className="px-4 py-4">Tip livrare</th>
                  {!scheduledSection ? <th className="px-4 py-4">Creată</th> : null}
                  <th className="px-4 py-4">Cost estimat</th>
                  <th className="px-4 py-4 text-right">Detalii</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const statusLabel = scheduledSection
                    ? getStatusLabel(order)
                    : (order.operationalStateLabel ?? getStatusLabel(order));
                  const dateLabel = scheduledSection
                    ? getScheduledDateLabel(order)
                    : formatDateTime(order.createdAt);

                  return (
                    <tr key={order.id} className="border-t border-border/80 bg-card">
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{order.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {scheduledSection
                              ? `Programată pentru ${dateLabel}`
                              : (order.operationalStateLabel ?? "Comandă din istoric")}
                          </p>
                        </div>
                      </td>
                      {!scheduledSection ? (
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1 text-sm">
                            <p className="text-foreground">{order.pickupArea}</p>
                            <p className="text-muted-foreground">către {order.dropoffArea}</p>
                          </div>
                        </td>
                      ) : null}
                      <td className="px-4 py-4 align-top">
                        <StatusBadge label={statusLabel} tone={getStatusTone(order)} />
                      </td>
                      {!scheduledSection ? (
                        <td className="px-4 py-4 align-top">
                          <StatusBadge
                            label={order.payment.statusLabel}
                            tone={getPaymentTone(order.payment.status)}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                        {formatDeliveryUrgency(order.urgency)}
                      </td>
                      {!scheduledSection ? (
                        <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                          {dateLabel}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 align-top text-sm font-medium text-foreground">
                        {order.estimatedCostLabel}
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <OrderActions order={order} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 compact-ui:grid expanded-ui:hidden">
            {orders.map((order) => {
              const statusLabel = scheduledSection
                ? getStatusLabel(order)
                : (order.operationalStateLabel ?? getStatusLabel(order));
              const dateLabel = scheduledSection
                ? getScheduledDateLabel(order)
                : formatDateTime(order.createdAt);

              return (
                <Card key={order.id} className="rounded-[calc(var(--radius)+0.5rem)]">
                  <CardContent className="grid gap-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="break-all font-medium text-foreground">{order.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {scheduledSection ? `Programată pentru ${dateLabel}` : dateLabel}
                        </p>
                      </div>
                      <StatusBadge label={statusLabel} tone={getStatusTone(order)} />
                    </div>

                    {!scheduledSection ? (
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          label={`Plată ${order.payment.statusLabel.toLocaleLowerCase("ro-RO")}`}
                          tone={getPaymentTone(order.payment.status)}
                        />
                        <StatusBadge label={order.payment.methodDetail} tone="neutral" />
                      </div>
                    ) : null}

                    {!scheduledSection ? (
                      <div className="grid gap-3 text-sm">
                        <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/45 px-4 py-3">
                          <p className="text-muted-foreground">Zona ridicare</p>
                          <p className="mt-1 font-medium text-foreground">{order.pickupArea}</p>
                        </div>
                        <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/45 px-4 py-3">
                          <p className="text-muted-foreground">Zona livrare</p>
                          <p className="mt-1 font-medium text-foreground">{order.dropoffArea}</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-background px-4 py-3">
                        <p className="text-sm text-muted-foreground">Tip livrare</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatDeliveryUrgency(order.urgency)}
                        </p>
                      </div>
                      <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-background px-4 py-3">
                        <p className="text-sm text-muted-foreground">Cost estimat</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {order.estimatedCostLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {order.runtimeOrder ? (
                        <RepeatDeliveryButton
                          order={order.runtimeOrder}
                          size="lg"
                          className="w-full"
                        />
                      ) : null}
                      <AppButton asChild variant="outline" size="lg">
                        <Link href={order.href}>
                          Vezi detalii
                          <ArrowRight className="size-4" />
                        </Link>
                      </AppButton>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </SectionCard>
  );
}

export function ClientOrdersView({ orders }: { orders: ClientOrderSummary[] }) {
  const [activeTab, setActiveTab] = useState<OrdersTab>("completed");
  const allOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
    [orders],
  );
  const scheduledOrders = allOrders
    .filter(isFutureScheduledOrder)
    .sort(
      (left, right) =>
        Date.parse(left.scheduledFor ?? "") -
        Date.parse(right.scheduledFor ?? ""),
    );
  const completedOrders = allOrders.filter((order) => !isFutureScheduledOrder(order));
  const activeOrders = activeTab === "scheduled" ? scheduledOrders : completedOrders;

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        title="Comenzi"
        description="Istoricul comenzilor tale și livrările programate."
      />

      <div className="grid gap-2 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-1.5 sm:inline-grid sm:w-fit sm:grid-cols-2">
        {[
          {
            id: "completed" as const,
            label: "Comenzi finalizate",
            count: completedOrders.length,
          },
          {
            id: "scheduled" as const,
            label: "Comenzi programate",
            count: scheduledOrders.length,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "min-h-11 rounded-[calc(var(--radius)+0.25rem)] px-4 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-75">{tab.count}</span>
            </button>
          );
        })}
      </div>

      <OrderListSection
        title={
          activeTab === "scheduled"
            ? "Comenzi programate"
            : "Comenzi finalizate"
        }
        description={
          activeTab === "scheduled"
            ? "Comenzi setate pentru o dată și o oră viitoare."
            : "Lista comenzilor salvate în baza de date."
        }
        orders={activeOrders}
        scheduledSection={activeTab === "scheduled"}
      />
    </section>
  );
}
