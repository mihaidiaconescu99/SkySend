"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  CreditCard,
  MapPinned,
  RadioTower,
  Route,
  Warehouse,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { RepeatDeliveryButton } from "@/components/delivery/repeat-delivery-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { droneFleet } from "@/constants/drone-fleet";
import { missionStatusLabels } from "@/constants/mission";
import { useCreatedDeliveryOrders } from "@/hooks/use-created-delivery-orders";
import { useNotificări } from "@/hooks/use-notifications";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { MissionStatus } from "@/types/mission";

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getOrderStatusLabel(order: CreatedDeliveryOrder) {
  if (order.fulfillmentStatus === "canceled") {
    return "Comandă anulată";
  }

  if (order.missionStatus && order.missionStatus in missionStatusLabels) {
    return missionStatusLabels[order.missionStatus as MissionStatus];
  }

  if (order.paymentStatus === "paid") {
    return "Plată confirmată";
  }

  if (order.paymentStatus === "processing") {
    return "Plată în procesare";
  }

  return "Plată necesară";
}

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

function getRouteLabel(order: CreatedDeliveryOrder) {
  return `${order.payload.selectedPickupPoint.label} către ${order.payload.selectedDropoffPoint.label}`;
}

export function ClientDashboardView() {
  const { orders } = useCreatedDeliveryOrders();
  const { notifications, unreadCount } = useNotificări();

  const activeOrder = useMemo(
    () => orders.find((order) => isActiveOrder(order)) ?? null,
    [orders],
  );
  const recentOrders = orders.slice(0, 4);
  const recentNotificări = notifications.slice(0, 3);

  return (
    <section id="overview" className="grid gap-6">
      <Card className="rounded-[var(--ui-radius-panel)] border-border/80 bg-card shadow-[var(--elevation-panel)]">
        <CardContent className="grid gap-6 p-5 sm:p-7 lg:p-8">
          {activeOrder ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-3">
                  <StatusBadge label="Livrare activă" tone="info" />
                  <div>
                    <h2 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
                      {getOrderStatusLabel(activeOrder)}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                      {getRouteLabel(activeOrder)}
                    </p>
                  </div>
                </div>
                <AppButton asChild size="lg">
                  <Link href={activeOrder.href}>Urmărește live</Link>
                </AppButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                  <p className="text-sm text-muted-foreground">ETA</p>
                  <p className="mt-2 font-heading text-2xl tracking-tight text-foreground">
                    {activeOrder.payload.estimatedEta.minMinutes} to{" "}
                    {activeOrder.payload.estimatedEta.maxMinutes} min
                  </p>
                </div>
                <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                  <p className="text-sm text-muted-foreground">Dronă</p>
                  <p className="mt-2 font-heading text-2xl tracking-tight text-foreground">
                    {activeOrder.payload.recommendedDroneClass.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                  <p className="text-sm text-muted-foreground">Comandă</p>
                  <p className="mt-2 font-heading text-2xl tracking-tight text-foreground">
                    {activeOrder.id}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3">
                <StatusBadge label="Acoperire activă în Pitești" tone="info" />
                <div>
                  <h2 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
                    Gata să trimiți un colet?
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Creează o livrare cu drona în zona activă de servicii Pitești.
                  </p>
                </div>
              </div>
              <AppButton asChild size="lg">
                <Link href="/client/create-delivery">
                  <Route className="size-4" />
                  Creează livrare
                </Link>
              </AppButton>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          eyebrow="Operațiuni"
          title="Drone disponibile"
          description="Vizibilitate asupra flotei pentru hub-ul activ al orașului."
        >
          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
              <Warehouse className="mt-0.5 size-4 text-foreground" />
              <div>
                <p className="font-medium text-foreground">SkySend Pitești Hub</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Hub activ pentru dispatch în Pitești și pregătirea lockerului.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
              <RadioTower className="mt-0.5 size-4 text-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {droneFleet.length} modele de drone configurate
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Statusul flotei va apărea aici după dispatch.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Comenzi"
          title="Comenzi recente"
          description="O listă compactă cu cele mai recente cereri de livrare."
        >
          <div className="grid gap-3">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{order.id}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {getRouteLabel(order)}
                      </p>
                    </div>
                    <StatusBadge label={getOrderStatusLabel(order)} tone="info" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton asChild variant="outline" size="sm">
                      <Link href={order.href}>Vezi detalii</Link>
                    </AppButton>
                    <RepeatDeliveryButton order={order} variant="ghost" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formatCurrency(
                      order.payload.estimatedPrice.amountMinor,
                      order.payload.estimatedPrice.currency,
                    )}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
                Comenzile vor apărea aici după checkout.
              </div>
            )}
          </div>
          <AppButton asChild variant="outline" className="w-full sm:w-fit">
            <Link href="/client/orders">Vezi comenzile</Link>
          </AppButton>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          eyebrow="Notificări"
          title="Actualizări recente"
          description={`${unreadCount} actualizare necitită${unreadCount === 1 ? "" : "s"}.`}
        >
          {recentNotificări.length ? (
            <div className="grid gap-2">
              {recentNotificări.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.actionUrl ?? "/client/notifications"}
                  className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/35 px-4 py-3 transition-colors hover:border-primary/35 hover:bg-secondary/55"
                >
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {notification.message}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-4">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 size-4 text-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Nu există notificări noi.
                </p>
              </div>
            </div>
          )}
          <AppButton asChild variant="outline" className="w-full">
            <Link href="/client/notifications">Deschide notificările</Link>
          </AppButton>
        </SectionCard>

        <SectionCard
          eyebrow="Locații"
          title="Locații salvate"
          description="Păstrează pregătite punctele frecvente de ridicare și livrare."
        >
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-4">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 size-4 text-foreground" />
              <p className="text-sm leading-6 text-muted-foreground">
                Locațiile salvate apar după ce adaugi adrese folosite frecvent.
              </p>
            </div>
          </div>
          <AppButton asChild variant="outline" className="w-full">
            <Link href="/client/saved-places">Gestionează locațiile salvate</Link>
          </AppButton>
        </SectionCard>

        <SectionCard
          eyebrow="Plăți"
          title="Acces plăți"
          description="Gestionează cardurile și istoricul plăților."
        >
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 size-4 text-foreground" />
              <p className="text-sm leading-6 text-muted-foreground">
                Metodele de plată și istoricul sunt disponibile în zona Plăți.
              </p>
            </div>
          </div>
          <AppButton asChild variant="outline" className="w-full">
            <Link href="/client/payment-methods">Deschide plățile</Link>
          </AppButton>
        </SectionCard>
      </div>

    </section>
  );
}

