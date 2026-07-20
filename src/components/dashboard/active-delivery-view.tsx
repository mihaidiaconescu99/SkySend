"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  Copy,
  Link2,
  Package2,
  Route,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { missionStatusLabels } from "@/constants/mission";
import { useCreatedDeliveryOrders } from "@/hooks/use-created-delivery-orders";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { updateCreatedDeliveryOrderFulfillment } from "@/lib/create-delivery-submit";
import {
  getRecipientTrackingPath,
  normalizePublicTrackingCode,
} from "@/lib/recipient-tracking";
import {
  formatScheduledDeliveryCountdown,
  formatScheduledDeliveryDate,
  getScheduledDeliveryStartMs,
  isScheduledDeliveryWaiting,
} from "@/lib/scheduled-delivery";
import { showToast } from "@/lib/toast-store";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { MissionStatus } from "@/types/mission";

function hasTerminalDeliveryStatus(order: CreatedDeliveryOrder) {
  return (
    order.fulfillmentStatus === "completed_mission" ||
    order.fulfillmentStatus === "failed_mission" ||
    order.fulfillmentStatus === "fallback_required" ||
    order.fulfillmentStatus === "canceled" ||
    order.paymentStatus === "failed" ||
    order.paymentStatus === "refunded" ||
    order.paymentStatus === "refund_pending" ||
    Boolean(order.fallbackOutcome)
  );
}

function isActiveOrder(order: CreatedDeliveryOrder) {
  if (hasTerminalDeliveryStatus(order)) {
    return false;
  }

  return (
    order.fulfillmentStatus === "active_mission" ||
    order.paymentStatus === "paid" ||
    order.paymentStatus === "processing"
  );
}

function getOrderStatusLabel(order: CreatedDeliveryOrder) {
  if (order.missionStatus && order.missionStatus in missionStatusLabels) {
    return missionStatusLabels[order.missionStatus as MissionStatus];
  }

  if (order.paymentStatus === "paid") {
    return "Comandă plasată";
  }

  if (order.paymentStatus === "processing") {
    return "Plată în procesare";
  }

  return "Plată necesară";
}

function getAbsoluteTrackingLink(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

async function copyText(value: string, successTitle: string) {
  await navigator.clipboard.writeText(value);
  showToast({
    title: successTitle,
    tone: "success",
  });
}

function ActiveDeliveryOrderCard({
  order,
  nowMs,
  isCancelling,
  onCancel,
}: {
  order: CreatedDeliveryOrder;
  nowMs: number;
  isCancelling: boolean;
  onCancel: (order: CreatedDeliveryOrder) => void;
}) {
  const isWaitingForScheduledStart =
    order.paymentStatus === "paid" && isScheduledDeliveryWaiting(order, nowMs);
  const scheduledStartMs = getScheduledDeliveryStartMs(order);
  const scheduledDateLabel = formatScheduledDeliveryDate(
    order.payload.scheduledAt,
  );
  const scheduledCountdownLabel =
    isWaitingForScheduledStart && scheduledStartMs !== null
      ? formatScheduledDeliveryCountdown(scheduledStartMs - nowMs)
      : null;

  return (
    <div className="grid gap-4 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4">
      {isWaitingForScheduledStart ? (
        <div className="rounded-[calc(var(--radius)+0.5rem)] border border-primary/30 bg-primary/10 p-4 shadow-[var(--elevation-soft)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <CalendarClock className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  Livrare programată
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {scheduledDateLabel
                    ? `Start programat: ${scheduledDateLabel}`
                    : "Startul programat este salvat pentru această comandă."}
                </p>
              </div>
            </div>
            <StatusBadge label="În așteptare" tone="info" />
          </div>
          <div className="mt-5 rounded-[calc(var(--radius)+0.375rem)] border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Începe în
            </p>
            <p className="mt-2 font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
              {scheduledCountdownLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Livrarea începe automat la ora programată. Până atunci nu pornim
              ETA live sau simularea dronei.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all font-medium text-foreground">{order.id}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {order.payload.selectedPickupPoint.label} către{" "}
              {order.payload.selectedDropoffPoint.label}
            </p>
          </div>
          <StatusBadge
            label={
              isWaitingForScheduledStart
                ? "În așteptare"
                : getOrderStatusLabel(order)
            }
            tone="info"
          />
        </div>
      </div>

      {order.publicTrackingCode ? (
        <div className="grid gap-4 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-card p-4">
          <div className="flex flex-col gap-3 expanded-ui:flex-row expanded-ui:items-center expanded-ui:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                Cod comandă
              </p>
              <p className="mt-1 w-fit max-w-full truncate rounded-full border border-border/80 bg-background px-3 py-1.5 font-mono text-sm font-semibold tracking-normal text-foreground">
                {normalizePublicTrackingCode(order.publicTrackingCode)}
              </p>
            </div>
            <div className="grid gap-2 expanded-ui:min-w-80 expanded-ui:grid-cols-2">
              <AppButton
                type="button"
                variant="outline"
                onClick={() =>
                  copyText(
                    normalizePublicTrackingCode(order.publicTrackingCode ?? ""),
                    "Codul comenzii a fost copiat",
                  )
                }
              >
                <Copy className="size-4" />
                Copiază codul
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                onClick={() =>
                  copyText(
                    getAbsoluteTrackingLink(
                      getRecipientTrackingPath({
                        code: order.publicTrackingCode,
                        token: order.recipientTrackingToken,
                      }),
                    ),
                    "Linkul de urmărire a fost copiat",
                  )
                }
              >
                <Link2 className="size-4" />
                Copiază linkul de urmărire
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <AppButton asChild className="w-full sm:w-fit">
          <Link href={order.href}>
            {isWaitingForScheduledStart ? "Vezi comanda" : "Urmărește live"}
            <ArrowRight className="size-4" />
          </Link>
        </AppButton>
        <AppButton
          type="button"
          variant="outline"
          className="w-full sm:w-fit"
          disabled={isCancelling}
          onClick={() => onCancel(order)}
        >
          <Ban className="size-4" />
          Anulează livrarea
        </AppButton>
      </div>
    </div>
  );
}

export function ActiveDeliveryView() {
  const { orders } = useCreatedDeliveryOrders();
  const { currentMission, resetMission } = useMissionRuntime();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((order) => isActiveOrder(order)),
    [orders],
  );
  const hasActiveOrders = activeOrders.length > 0;

  function handleCancelActiveOrder(order: CreatedDeliveryOrder) {
    const confirmed = window.confirm(
      "Anulezi această livrare activă? Simularea se oprește pentru comanda curentă.",
    );

    if (!confirmed) {
      return;
    }

    setCancellingOrderId(order.id);

    if (currentMission?.sourceOrderId === order.id) {
      resetMission();
    }

    updateCreatedDeliveryOrderFulfillment({
      orderId: order.id,
      fulfillmentStatus: "canceled",
      missionId: order.missionId ?? null,
      missionStatus: "mission_failed",
    });
    const updatedOrder = true;

    showToast({
      title: updatedOrder ? "Livrare anulată" : "Livrarea nu a putut fi anulată",
      message: updatedOrder
        ? "Comanda a fost oprită și nu mai continuă simularea activă."
        : "Reîncearcă după ce lista de livrări se actualizează.",
      tone: updatedOrder ? "warning" : "destructive",
    });
    setCancellingOrderId(null);
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Livrări active"
        title="Acces la livrările live"
        description="Deschide spațiul de urmărire pentru livrările active."
      />

      <SectionCard
        eyebrow={hasActiveOrders ? "Urmărire" : "Nicio livrare activă"}
        title={
          hasActiveOrders
            ? activeOrders.length === 1
              ? "O livrare activă"
              : `${activeOrders.length} livrări active`
            : "Nu există livrări active"
        }
        description={
          hasActiveOrders
            ? "Continuă la detaliile fiecărei comenzi pentru hartă live, actualizări și acțiuni locker."
            : "Creează și plătește o livrare pentru a porni urmărirea live."
        }
      >
        {hasActiveOrders ? (
          <div className="grid gap-4">
            {activeOrders.map((order) => (
              <ActiveDeliveryOrderCard
                key={order.id}
                order={order}
                nowMs={nowMs}
                isCancelling={cancellingOrderId === order.id}
                onCancel={handleCancelActiveOrder}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-4">
              <div className="flex items-start gap-3">
                <Package2 className="mt-0.5 size-4 text-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Urmăririle active apar aici după confirmarea plății.
                </p>
              </div>
            </div>
            <AppButton asChild className="w-full sm:w-fit">
              <Link href="/client/create-delivery">
                <Route className="size-4" />
                Creează livrare
              </Link>
            </AppButton>
          </div>
        )}
      </SectionCard>
    </section>
  );
}
