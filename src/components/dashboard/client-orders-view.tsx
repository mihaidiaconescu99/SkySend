"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Clock3, PackageX } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import type { ClientOrderSummary } from "@/types/client-orders";

type OrdersTab = "all" | "scheduled";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isFutureScheduledOrder(order: ClientOrderSummary) {
  return order.statusFilter === "scheduled" && Boolean(order.scheduledFor) &&
    Date.parse(order.scheduledFor ?? "") > Date.now();
}

function compactAddress(value: string) {
  const firstPart = value.split(",")[0]?.trim() || value;
  return firstPart
    .replace(/^(strada|str\.|bulevardul|bd\.|calea|aleea)\s+/i, "")
    .replace(/\s+(nr\.?\s*)?\d+[a-z]?$/i, "")
    .trim() || firstPart;
}

function statusPresentation(order: ClientOrderSummary) {
  if (isFutureScheduledOrder(order)) return { label: "Programată", className: "text-amber-500" };
  switch (order.statusFilter) {
    case "active": return { label: "Activă", className: "text-primary" };
    case "completed": return { label: "Finalizată", className: "text-emerald-500" };
    case "failed": return { label: "Eșuată", className: "text-destructive" };
    case "cancelled": return { label: "Anulată", className: "text-muted-foreground" };
    case "scheduled": return { label: "Programată", className: "text-amber-500" };
    default: return { label: order.operationalStateLabel ?? "Înregistrată", className: "text-foreground" };
  }
}

function EmptyOrders({ scheduled }: { scheduled: boolean }) {
  const Icon = scheduled ? Clock3 : PackageX;
  return (
    <div className="grid min-h-64 place-items-center border-t border-border/70 px-5 py-12 text-center">
      <div>
        <Icon className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 font-heading text-xl">
          {scheduled ? "Nu ai livrări programate" : "Nu ai încă nicio comandă"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {scheduled ? "Livrările viitoare vor apărea aici." : "Prima comandă va apărea aici după confirmare."}
        </p>
      </div>
    </div>
  );
}

function DetailsLink({ order }: { order: ClientOrderSummary }) {
  return (
    <AppButton asChild variant="ghost" size="sm" className="shrink-0">
      <Link href={order.href}>Detalii<ArrowRight className="size-4" /></Link>
    </AppButton>
  );
}

export function ClientOrdersView({ orders }: { orders: ClientOrderSummary[] }) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<OrdersTab>(
    searchParams.get("view") === "scheduled" ? "scheduled" : "all",
  );
  const allOrders = useMemo(() => [...orders].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  ), [orders]);
  const scheduledOrders = useMemo(() => allOrders.filter(isFutureScheduledOrder).sort(
    (a, b) => Date.parse(a.scheduledFor ?? "") - Date.parse(b.scheduledFor ?? ""),
  ), [allOrders]);
  const visibleOrders = activeTab === "scheduled" ? scheduledOrders : allOrders;

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader title="Comenzi" />

      <div className="relative grid w-full grid-cols-2 rounded-xl border border-border/70 bg-secondary/30 p-1 sm:w-fit sm:min-w-[25rem]">
        {([{"id":"all","label":"Toate comenzile","count":allOrders.length},{"id":"scheduled","label":"Comenzi programate","count":scheduledOrders.length}] as const).map((tab) => (
          <button key={tab.id} type="button" aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative z-10 min-h-10 rounded-lg px-4 text-sm font-medium text-foreground">
            {activeTab === tab.id ? (
              <motion.span layoutId="orders-tab" className="absolute inset-0 -z-10 rounded-lg bg-background shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />
            ) : null}
            {tab.label}<span className="ml-2 text-xs text-muted-foreground">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--ui-radius-panel)] border border-border/70 bg-card">
        <div className="hidden grid-cols-[minmax(7rem,.75fr)_minmax(14rem,1.7fr)_minmax(7rem,.8fr)_minmax(9rem,1fr)_minmax(6rem,.7fr)_auto] gap-4 border-b border-border/70 px-5 py-4 text-xs font-medium uppercase tracking-[.12em] text-muted-foreground expanded-ui:grid">
          <span>Cod</span><span>Traseu</span><span>Status</span><span>Creată</span><span>Cost</span><span className="sr-only">Acțiuni</span>
        </div>
        {visibleOrders.length === 0 ? <EmptyOrders scheduled={activeTab === "scheduled"} /> : (
          <div className="divide-y divide-border/70">
            {visibleOrders.map((order) => {
              const status = statusPresentation(order);
              return (
                <article key={order.id} className="grid gap-4 px-4 py-5 transition-colors hover:bg-secondary/20 expanded-ui:grid-cols-[minmax(7rem,.75fr)_minmax(14rem,1.7fr)_minmax(7rem,.8fr)_minmax(9rem,1fr)_minmax(6rem,.7fr)_auto] expanded-ui:items-center expanded-ui:px-5">
                  <p className="break-all font-mono text-sm font-semibold text-foreground">{order.id}</p>
                  <div className="min-w-0 text-sm">
                    <p className="truncate text-foreground">{compactAddress(order.pickupArea)}</p>
                    <p className="truncate text-muted-foreground">→ {compactAddress(order.dropoffArea)}</p>
                  </div>
                  <p className={cn("text-sm font-medium", status.className)}>{status.label}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                  <p className="text-sm font-medium text-foreground">{order.estimatedCostLabel}</p>
                  <div className="flex justify-end"><DetailsLink order={order} /></div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
