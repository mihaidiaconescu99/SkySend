
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Clock3,
  Inbox,
  Loader2,
  Package2,
  RadioTower,
  RefreshCw,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cancelRuntimeOrdersInProgress } from "@/lib/admin-data";
import { cn } from "@/lib/utils";
import type { AdminAuditActor, OperationalPlatformStatus } from "@/types/admin";
import type {
  OperationalCenterData,
  OperationalContactMessage,
  OperationalEvent,
  OperationalIncident,
  OperationalMapOrder,
} from "@/types/admin-operational";

type OperationalCenterViewProps = {
  initialData: OperationalCenterData;
};

type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";
type BulkOrderActionFeedback = {
  tone: "success" | "destructive";
  message: string;
};
const adminBulkActor: AdminAuditActor = {
  actorId: "admin-local",
  actorRole: "admin",
  actorName: "Panou Administrator",
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Nesalvat";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: OperationalMapOrder["price"]) {
  if (!value) {
    return "PreÈ› indisponibil";
  }

  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: value.currency,
  }).format(value.amountMinor / 100);
}

function getOrderTone(order: OperationalMapOrder): StatusTone {
  if (order.status === "in_flight") {
    return "info";
  }

  if (order.status === "queued" || order.status === "scheduled") {
    return "warning";
  }

  return "neutral";
}

function getIncidentTone(incident: OperationalIncident): StatusTone {
  if (incident.priority === "urgent") {
    return "destructive";
  }

  if (incident.priority === "high") {
    return "warning";
  }

  return "neutral";
}

function getEventTone(tone: OperationalEvent["tone"]): StatusTone {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "destructive":
      return "destructive";
    case "info":
      return "info";
    case "neutral":
      return "neutral";
  }
}

function getPlatformTone(status: OperationalPlatformStatus): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "maintenance":
      return "warning";
  }
}

function EmptyQueueState({ children }: { children: string }) {
  return (
    <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: StatusTone;
}) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.375rem)]">
      <CardContent className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <StatusBadge
            label={tone === "destructive" ? "Urgent" : "Status"}
            tone={tone}
          />
        </div>
        <p className="font-heading text-3xl tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QueueHeader({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof Package2;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3">
        <div className="mt-0.5 rounded-full bg-secondary p-2 text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <AppButton asChild variant="outline" size="sm">
        <Link href={href}>
          Deschide
          <ArrowRight className="size-4" />
        </Link>
      </AppButton>
    </div>
  );
}

function ActiveOrdersQueue({ orders }: { orders: OperationalMapOrder[] }) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <QueueHeader
          icon={Package2}
          title="Comenzi active"
          description="Programate, Ã®n aÈ™teptare sau Ã®n zbor, ordonate dupÄƒ starea curentÄƒ."
          href="/admin/orders"
        />

        <div className="grid gap-2">
          {orders.slice(0, 8).map((order) => (
            <Link
              key={order.id}
              href={order.href}
              className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-card p-4 transition-colors hover:border-primary/45 hover:bg-secondary/30 lg:grid-cols-[8rem_minmax(0,1.1fr)_minmax(0,1.3fr)_7rem_8rem]"
            >
              <div>
                <p className="text-xs text-muted-foreground">Comanda</p>
                <p className="mt-1 font-medium text-foreground">{order.shortId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {order.customerName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ruta</p>
                <p className="mt-1 truncate text-sm text-foreground">
                  {order.pickup.label} cÄƒtre {order.dropoff.label}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ETA</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {order.etaLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <StatusBadge label={order.statusLabel} tone={getOrderTone(order)} />
              </div>
            </Link>
          ))}

          {orders.length === 0 ? (
            <EmptyQueueState>Nu existÄƒ comenzi active Ã®n datele disponibile.</EmptyQueueState>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FailedOrdersQueue({ incidents }: { incidents: OperationalIncident[] }) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <QueueHeader
          icon={ShieldAlert}
          title="Incidente"
          description="Cazuri de rezolvat operaÈ›ional, fÄƒrÄƒ recuperÄƒri locker dublate."
          href="/admin/failed-orders"
        />

        <div className="grid gap-2">
          {incidents.slice(0, 8).map((incident) => (
            <Link
              key={incident.id}
              href={incident.href}
              className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-card p-4 transition-colors hover:border-primary/45 hover:bg-secondary/30 lg:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.2fr)_8rem]"
            >
              <div>
                <p className="text-xs text-muted-foreground">Comanda</p>
                <p className="mt-1 font-medium text-foreground">
                  {incident.shortOrderId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motiv</p>
                <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                  {incident.description}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">LocaÈ›ie colet</p>
                <p className="mt-1 truncate text-sm text-foreground">
                  {incident.locationLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <StatusBadge
                  label={incident.priorityLabel}
                  tone={getIncidentTone(incident)}
                />
              </div>
            </Link>
          ))}

          {incidents.length === 0 ? (
            <EmptyQueueState>Nu existÄƒ incidente Ã®n datele disponibile.</EmptyQueueState>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ContactMessagesQueue({
  messages,
}: {
  messages: OperationalContactMessage[];
}) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <QueueHeader
          icon={Inbox}
          title="Mesaje noi"
          description="Mesaje primite È™i nesortate Ã®ncÄƒ Ã®n fluxul de suport."
          href="/admin/site-messages"
        />

        <div className="grid gap-2">
          {messages.slice(0, 6).map((message) => (
            <Link
              key={message.id}
              href={message.href}
              className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-card p-4 transition-colors hover:border-primary/45 hover:bg-secondary/30 sm:grid-cols-[minmax(0,1fr)_8rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {message.subject}
                  </p>
                  <StatusBadge label={message.categoryLabel} tone="info" />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {message.email} / {formatDateTime(message.createdAt)}
                </p>
              </div>
              <div className="flex items-center sm:justify-end">
                <StatusBadge label={message.statusLabel} tone="info" />
              </div>
            </Link>
          ))}

          {messages.length === 0 ? (
            <EmptyQueueState>Nu existÄƒ mesaje noi.</EmptyQueueState>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformStatusPanel({ data }: { data: OperationalCenterData }) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <QueueHeader
          icon={Settings}
          title="Status platformÄƒ"
          description="SetÄƒri operaÈ›ionale folosite de panoul admin."
          href="/admin/settings"
        />

        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
            <span className="text-muted-foreground">Platforma</span>
            <StatusBadge
              label={data.platform.statusLabel}
              tone={getPlatformTone(data.platform.status)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
            <span className="text-muted-foreground">RazÄƒ activÄƒ</span>
            <span className="font-medium text-foreground">
              {data.platform.serviceRadiusKm} km
            </span>
          </div>
          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
            <p className="text-muted-foreground">Hub</p>
            <p className="mt-2 text-sm font-medium leading-6 text-foreground">
              {data.platform.hubAddressLabel}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
            <span className="text-muted-foreground">Ultima salvare</span>
            <span className="text-right font-medium text-foreground">
              {formatDateTime(data.platform.updatedAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LockerRecoveryNotice({
  incidents,
}: {
  incidents: OperationalIncident[];
}) {
  if (incidents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-warning/35 bg-warning/8 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 text-warning" />
        <p className="text-muted-foreground">
          {incidents.length} recuperÄƒri locker active generate de simulare.
        </p>
      </div>
      <AppButton asChild variant="outline" size="sm">
        <Link href="/admin/locker-recoveries">
          Vezi recuperÄƒri
          <ArrowRight className="size-4" />
        </Link>
      </AppButton>
    </div>
  );
}

function ActivityFeed({ events }: { events: OperationalEvent[] }) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">Activitate recentÄƒ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Evenimente calculate din comenzile È™i cazurile existente.
            </p>
          </div>
          <Clock3 className="size-5 text-muted-foreground" />
        </div>

        <div className="grid gap-2">
          {events.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge
                  label={event.tone === "destructive" ? "Urgent" : "Eveniment"}
                  tone={getEventTone(event.tone)}
                />
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(event.occurredAt)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {event.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {event.description}
              </p>
            </div>
          ))}

          {events.length === 0 ? (
            <EmptyQueueState>Nu existÄƒ activitate recentÄƒ de afiÈ™at.</EmptyQueueState>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminOperationalCenterView({
  initialData,
}: OperationalCenterViewProps) {
  const [data, setData] = useState(initialData);
  const [bulkActionFeedback, setBulkActionFeedback] =
    useState<BulkOrderActionFeedback | null>(null);
  const [bulkActionRunning, setBulkActionRunning] = useState<"cancel" | null>(
    null,
  );
  const [isManualRefreshRunning, setIsManualRefreshRunning] = useState(false);
  const refreshOperationalData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/operational-center", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const refreshed = (await response.json()) as OperationalCenterData;

      setData(refreshed);
    } catch {
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshOperationalData);
  }, [refreshOperationalData]);


  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshOperationalData();
      }
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshOperationalData]);

  const failedIncidents = useMemo(
    () => data.incidents.filter((incident) => incident.kind === "failed_order"),
    [data.incidents],
  );
  const lockerIncidents = useMemo(
    () => data.incidents.filter((incident) => incident.kind === "locker_recovery"),
    [data.incidents],
  );
  const urgentFailedCount = failedIncidents.filter(
    (incident) => incident.priority === "urgent" || incident.priority === "high",
  ).length;

  function handleCancelActiveOrders() {
    if (data.activeOrders.length === 0) {
      setBulkActionFeedback({
        tone: "success",
        message: "Nu existÄƒ comenzi Ã®n desfÄƒÈ™urare de anulat.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Anulezi ${data.activeOrders.length} comenzi Ã®n desfÄƒÈ™urare? Comenzile vor rÄƒmÃ¢ne Ã®n istoric, dar nu vor mai apÄƒrea ca livrÄƒri active.`,
    );

    if (!confirmed) {
      return;
    }

    setBulkActionRunning("cancel");
    const result = cancelRuntimeOrdersInProgress({
      actor: adminBulkActor,
      reason: "Anulare Ã®n masÄƒ din Privire generalÄƒ.",
    });

    if (!result.ok) {
      setBulkActionFeedback({
        tone: "destructive",
        message: "Comenzile nu pot fi anulate Ã®n acest browser deoarece stocarea localÄƒ nu este disponibilÄƒ.",
      });
      setBulkActionRunning(null);
      return;
    }

    refreshOperationalData();
    setBulkActionFeedback({
      tone: "success",
      message:
        result.affectedOrders === 1
          ? "O comandÄƒ Ã®n desfÄƒÈ™urare a fost anulatÄƒ."
          : `${result.affectedOrders} comenzi Ã®n desfÄƒÈ™urare au fost anulate.`,
    });
    setBulkActionRunning(null);
  }

  async function handleManualRefresh() {
    setIsManualRefreshRunning(true);
    await refreshOperationalData();
    setIsManualRefreshRunning(false);
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Privire generalÄƒ"
        description="Cozi de lucru pentru comenzi, incidente, mesaje È™i statusul platformei."
        actions={
          <>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => void handleManualRefresh()}
              disabled={isManualRefreshRunning}
            >
              {isManualRefreshRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={handleCancelActiveOrders}
              disabled={Boolean(bulkActionRunning) || data.activeOrders.length === 0}
            >
              {bulkActionRunning === "cancel" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              AnuleazÄƒ active
            </AppButton>
            <AppButton asChild variant="outline">
              <Link href="/admin/orders">
                Comenzi
                <ArrowRight className="size-4" />
              </Link>
            </AppButton>
            <AppButton asChild variant="outline">
              <Link href="/admin/site-messages">
                Mesaje
                <Inbox className="size-4" />
              </Link>
            </AppButton>
          </>
        }
      />

      {bulkActionFeedback ? (
        <div
          className={cn(
            "rounded-[calc(var(--radius)+0.35rem)] border px-4 py-3 text-sm leading-6",
            bulkActionFeedback.tone === "destructive"
              ? "border-destructive/40 bg-destructive/8 text-destructive"
              : "border-primary/35 bg-primary/10 text-foreground",
          )}
        >
          {bulkActionFeedback.message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          label="Comenzi active"
          value={`${data.activeOrders.length}`}
          hint="Programate, Ã®n aÈ™teptare sau Ã®n zbor."
          tone={data.activeOrders.length > 0 ? "info" : "neutral"}
        />
        <OverviewCard
          label="Incidente"
          value={`${failedIncidents.length}`}
          hint={
            urgentFailedCount > 0
              ? `${urgentFailedCount} cazuri cu prioritate ridicatÄƒ.`
              : "FÄƒrÄƒ cazuri prioritare Ã®n listÄƒ."
          }
          tone={urgentFailedCount > 0 ? "warning" : "neutral"}
        />
        {false ? <OverviewCard
          label="Mesaje noi"
          value={`${data.contactMessages.length}`}
          hint="Mesaje care nu au fost preluate Ã®ncÄƒ."
          tone={data.contactMessages.length > 0 ? "info" : "neutral"}
        /> : null}
        <OverviewCard
          label="Status platformÄƒ"
          value={data.platform.statusLabel}
          hint={`RazÄƒ activÄƒ: ${data.platform.serviceRadiusKm} km.`}
          tone={getPlatformTone(data.platform.status)}
        />
      </div>

      <LockerRecoveryNotice incidents={lockerIncidents} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <div className="grid gap-5">
          <ActiveOrdersQueue orders={data.activeOrders} />
          <FailedOrdersQueue incidents={failedIncidents} />
        </div>

        <div className="grid content-start gap-5">
          <PlatformStatusPanel data={data} />
          {false ? <ContactMessagesQueue messages={data.contactMessages} /> : null}
          <ActivityFeed events={data.events} />
        </div>
      </div>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <RadioTower className="size-5 text-primary" />
            <span>
              Actualizat: {formatDateTime(data.generatedAt)} /{" "}
              {data.droneMarkers.length} drone in zbor /{" "}
              {data.activeOrders.filter((order) => order.hasCompleteRoute).length} trasee complete.
            </span>
          </div>
          <span className="font-medium text-foreground">
            Venit activ estimat:{" "}
            {formatMoney({
              amountMinor: data.activeOrders.reduce(
                (total, order) => total + (order.price?.amountMinor ?? 0),
                0,
              ),
              currency: "RON",
            })}
          </span>
        </CardContent>
      </Card>
    </section>
  );
}
