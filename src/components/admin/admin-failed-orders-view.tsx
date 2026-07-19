"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleDollarSign,
  FileClock,
  LifeBuoy,
  MapPinned,
  PackageX,
  Send,
  ShieldAlert,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { FilterBar } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  failedOrderRefundOptions,
  failedOrderResolutionOptions,
  getAdminFailedOrderDetails,
  updateAdminFailedOrder,
} from "@/lib/admin-failed-orders";
import { adminFailureReasonLabels } from "@/lib/admin-data";
import type { AdminOrder } from "@/types/admin";
import { cn } from "@/lib/utils";
import type { AdminAuditActor } from "@/types/admin";
import type {
  AdminFailedOrderDetail,
  CustomerNotificationStatus,
  FailedOrderResolutionStatus,
  FailureReasonCode,
  RefundStatus,
} from "@/types/admin-failed-orders";
import type { FilterBarItem } from "@/types/ui";

type AdminFailedOrdersViewProps = {
  initialOrders: AdminFailedOrderDetail[];
};

type ReasonFilter = "all" | FailureReasonCode;
type ResolutionFilter = "all" | FailedOrderResolutionStatus;
type RefundFilter = "all" | RefundStatus;
type PriorityFilter = "all" | AdminFailedOrderDetail["priority"];
type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

const adminActor: AdminAuditActor = {
  actorId: "admin-local",
  actorRole: "admin",
  actorName: "Panou Administrator",
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Indisponibil";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatOrderId(orderId: string) {
  return orderId.split("_").at(-1)?.replace(/^0+/, "") || orderId;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

function getPriorityTone(priority: AdminFailedOrderDetail["priority"]): StatusTone {
  if (priority === "urgent") {
    return "destructive";
  }

  if (priority === "high") {
    return "warning";
  }

  if (priority === "low") {
    return "neutral";
  }

  return "info";
}

function getResolutionTone(status: FailedOrderResolutionStatus): StatusTone {
  switch (status) {
    case "resolved":
      return "success";
    case "archived":
      return "neutral";
    case "in_progress":
    case "waiting_for_customer":
      return "warning";
    case "open":
      return "info";
  }
}

function getRefundTone(status: RefundStatus): StatusTone {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "destructive";
    case "pending":
    case "started":
      return "warning";
    case "not_required":
    case "unknown":
      return "neutral";
  }
}

function getNotificationTone(status: CustomerNotificationStatus): StatusTone {
  switch (status) {
    case "sent":
      return "success";
    case "prepared":
    case "queued":
      return "warning";
    case "not_sent":
    case "unknown":
      return "neutral";
    case "not_required":
      return "info";
  }
}

function FailedOrderReasonBadge({ order }: { order: AdminFailedOrderDetail }) {
  const isLockerIncident = order.hasLockerRecoveryIncident;

  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge
        label={order.reasonLabel}
        tone={isLockerIncident ? "destructive" : "warning"}
      />
      {isLockerIncident ? (
        <StatusBadge label="Recuperare locker" tone="destructive" />
      ) : null}
    </div>
  );
}

function EmptyFailedOrdersState() {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-6 text-center">
        <div className="mx-auto rounded-full bg-success/10 p-3 text-success">
          <CheckCircle2 className="size-6" />
        </div>
        <div>
          <p className="font-medium text-foreground">Nu există incidente</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Când apar livrări eșuate sau anulate, ele vor fi listate aici
            pentru rezolvare operațională.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FailedOrderDetailsPanel({
  order,
  onUpdate,
  isSaving,
}: {
  order: AdminFailedOrderDetail | null;
  onUpdate: (
    orderId: string,
    patch: {
      resolutionStatus?: FailedOrderResolutionStatus;
      refundStatus?: RefundStatus;
      customerNotificationStatus?: CustomerNotificationStatus;
      internalNotes?: string | null;
    },
    reason: string | null,
  ) => void;
  isSaving: boolean;
}) {
  if (!order) {
    return (
      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="p-5 text-sm leading-6 text-muted-foreground">
          Selectează un incident pentru detalii.
        </CardContent>
      </Card>
    );
  }

  return (
    <FailedOrderDetailsPanelContent
      key={`${order.id}:${order.updatedAt}:${order.auditEventCount}`}
      order={order}
      onUpdate={onUpdate}
      isSaving={isSaving}
    />
  );
}

function FailedOrderDetailsPanelContent({
  order,
  onUpdate,
  isSaving,
}: {
  order: AdminFailedOrderDetail;
  onUpdate: (
    orderId: string,
    patch: {
      resolutionStatus?: FailedOrderResolutionStatus;
      refundStatus?: RefundStatus;
      customerNotificationStatus?: CustomerNotificationStatus;
      internalNotes?: string | null;
    },
    reason: string | null,
  ) => void;
  isSaving: boolean;
}) {
  const [internalNote, setInternalNote] = useState(order.internalNotes ?? "");
  const [reason, setReason] = useState("");

  function updateResolution(status: FailedOrderResolutionStatus) {
    onUpdate(
      order.orderId,
      { resolutionStatus: status },
      reason.trim() || `Status rezolvare setat la ${status}.`,
    );
  }

  function updateRefund(status: RefundStatus) {
    onUpdate(
      order.orderId,
      { refundStatus: status },
      reason.trim() || `Status rambursare actualizat.`,
    );
  }

  function updateNotification(status: CustomerNotificationStatus) {
    onUpdate(
      order.orderId,
      { customerNotificationStatus: status },
      reason.trim() || `Status notificare client actualizat manual.`,
    );
  }

  function saveInternalNote() {
    onUpdate(
      order.orderId,
      { internalNotes: internalNote.trim() || null },
      reason.trim() || "Notă internă actualizată pentru incident.",
    );
  }

  return (
    <div className="grid gap-5">
      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-heading text-xl tracking-tight text-foreground">
                Comanda {formatOrderId(order.orderId)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.customer.name} / {order.clientEmail ?? "email indisponibil"}
              </p>
            </div>
            <StatusBadge
              label={order.priorityLabel}
              tone={getPriorityTone(order.priority)}
            />
          </div>

          <FailedOrderReasonBadge order={order} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">Locație colet</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {order.parcelLocation.label}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.parcelLocation.coordinates
                  ? `${order.parcelLocation.coordinates.latitude.toFixed(5)}, ${order.parcelLocation.coordinates.longitude.toFixed(5)}`
                  : "Coordonate indisponibile"}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">Status colet</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {order.parcelStatusLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Drona/modul: {order.assignedDroneLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background p-4">
              <p className="text-xs text-muted-foreground">Rezolvare</p>
              <div className="mt-2">
                <StatusBadge
                  label={order.resolutionStatusLabel}
                  tone={getResolutionTone(order.resolutionStatus)}
                />
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background p-4">
              <p className="text-xs text-muted-foreground">Rambursare</p>
              <div className="mt-2">
                <StatusBadge
                  label={order.refundStatusLabel}
                  tone={getRefundTone(order.refundStatus)}
                />
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background p-4">
              <p className="text-xs text-muted-foreground">Notificare client</p>
              <div className="mt-2">
                <StatusBadge
                  label={order.customerNotificationStatusLabel}
                  tone={getNotificationTone(order.customerNotificationStatus)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
            <p className="text-xs text-muted-foreground">Motiv original eșec</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {order.originalReason ?? order.reasonLabel}
            </p>
          </div>

          {order.lockerRecoveryHref ? (
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-destructive/35 bg-destructive/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    Recuperare locker asociată
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Acest caz trebuie tratat în modulul de recuperare locker.
                  </p>
                </div>
                <AppButton asChild size="sm">
                  <Link href={order.lockerRecoveryHref}>
                    <MapPinned className="size-4" />
                    Deschide
                  </Link>
                </AppButton>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div>
            <p className="font-medium text-foreground">Acțiuni rezolvare</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Modificările sunt salvate în audit-ul intern al comenzii.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Motiv modificare
            </span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
              placeholder="Opțional, apare în audit"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notă internă
            </span>
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              rows={4}
              className="min-h-28 w-full rounded-2xl border border-input bg-muted px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="outline"
              onClick={() => updateResolution("in_progress")}
              disabled={isSaving}
            >
              <ShieldAlert className="size-4" />
              Marchează în lucru
            </AppButton>
            <AppButton
              type="button"
              onClick={() => updateResolution("resolved")}
              disabled={isSaving}
            >
              <CheckCircle2 className="size-4" />
              Marchează rezolvat
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => updateResolution("archived")}
              disabled={isSaving}
            >
              <Archive className="size-4" />
              Arhivează
            </AppButton>
          </div>

          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="outline"
              onClick={() => updateRefund("started")}
              disabled={isSaving || order.refundStatus === "not_required"}
            >
              <CircleDollarSign className="size-4" />
              Marchează rambursare în curs
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => updateRefund("completed")}
              disabled={isSaving || order.refundStatus === "not_required"}
            >
              <CircleDollarSign className="size-4" />
              Marchează rambursare finalizată
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => updateNotification("prepared")}
              disabled={isSaving}
            >
              <LifeBuoy className="size-4" />
              Notificare pregătită
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => updateNotification("sent")}
              disabled={isSaving}
            >
              <Send className="size-4" />
              Notificare trimisă manual
            </AppButton>
          </div>

          <AppButton
            type="button"
            variant="outline"
            onClick={saveInternalNote}
            disabled={isSaving}
            className="w-fit"
          >
            Salvează nota internă
          </AppButton>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-center gap-3">
            <FileClock className="size-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Audit comandă</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.auditEventCount} evenimente administrative salvate.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {order.order?.auditTrail.slice(0, 6).map((event) => (
              <div
                key={event.id}
                className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {event.field}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {event.actorName ?? event.actorId}
                  {event.reason ? ` / ${event.reason}` : ""}
                </p>
              </div>
            ))}
            {!order.order || order.order.auditTrail.length === 0 ? (
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground">
                Nu există încă evenimente audit pentru această comandă.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminFailedOrdersTable({
  orders,
  selectedOrderId,
  onSelect,
}: {
  orders: AdminFailedOrderDetail[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
}) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">Listă incidente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length} înregistrări după filtre.
            </p>
          </div>
          <PackageX className="size-5 text-muted-foreground" />
        </div>

        <div className="hidden overflow-x-auto rounded-[calc(var(--radius)+0.35rem)] border border-border/75 xl:block">
          <table className="w-full min-w-[72rem]">
            <thead className="bg-secondary/45 text-left">
              <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-4">Comandă</th>
                <th className="px-4 py-4">Client</th>
                <th className="px-4 py-4">Motiv eșec</th>
                <th className="px-4 py-4">Locație colet</th>
                <th className="px-4 py-4">Rambursare</th>
                <th className="px-4 py-4">Notificare</th>
                <th className="px-4 py-4">Prioritate</th>
                <th className="px-4 py-4">Rezolvare</th>
                <th className="px-4 py-4">Data eșecului</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isSelected = selectedOrderId === order.orderId;

                return (
                  <tr
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(order.orderId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(order.orderId);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-border/75 bg-card transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70",
                      isSelected && "bg-primary/6",
                    )}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-foreground">
                        {formatOrderId(order.orderId)}
                      </p>
                      {order.hasLockerRecoveryIncident ? (
                        <p className="mt-2 text-xs text-destructive">
                          Locker asociat
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <p className="font-medium text-foreground">
                        {order.customer.name}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {order.clientEmail ?? "E-mail indisponibil"}
                      </p>
                    </td>
                    <td className="max-w-[18rem] px-4 py-4 align-top">
                      <FailedOrderReasonBadge order={order} />
                    </td>
                    <td className="max-w-[16rem] px-4 py-4 align-top text-sm text-muted-foreground">
                      <p className="truncate text-foreground">
                        {order.parcelLocation.label}
                      </p>
                      <p className="mt-1">{order.parcelStatusLabel}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={order.refundStatusLabel}
                        tone={getRefundTone(order.refundStatus)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={order.customerNotificationStatusLabel}
                        tone={getNotificationTone(order.customerNotificationStatus)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={order.priorityLabel}
                        tone={getPriorityTone(order.priority)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={order.resolutionStatusLabel}
                        tone={getResolutionTone(order.resolutionStatus)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      {formatDateTime(order.failedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 xl:hidden">
          {orders.map((order) => {
            const isSelected = selectedOrderId === order.orderId;

            return (
              <Card
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(order.orderId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(order.orderId);
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-[calc(var(--radius)+0.375rem)] transition-colors hover:border-primary/35 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  isSelected && "border-primary/50",
                  order.hasLockerRecoveryIncident && "border-destructive/35",
                )}
              >
                <CardContent className="grid gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {formatOrderId(order.orderId)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.customer.name}
                      </p>
                    </div>
                    <StatusBadge
                      label={order.priorityLabel}
                      tone={getPriorityTone(order.priority)}
                    />
                  </div>
                  <FailedOrderReasonBadge order={order} />
                  <p className="text-sm leading-6 text-muted-foreground">
                    {order.parcelLocation.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={order.refundStatusLabel}
                      tone={getRefundTone(order.refundStatus)}
                    />
                    <StatusBadge
                      label={order.resolutionStatusLabel}
                      tone={getResolutionTone(order.resolutionStatus)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {orders.length === 0 ? <EmptyFailedOrdersState /> : null}
      </CardContent>
    </Card>
  );
}

export function AdminFailedOrdersView({
  initialOrders,
}: AdminFailedOrdersViewProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrders[0]?.orderId ?? null,
  );
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [draftReason, setDraftReason] = useState<ReasonFilter>("all");
  const [resolution, setResolution] = useState<ResolutionFilter>("all");
  const [draftResolution, setDraftResolution] =
    useState<ResolutionFilter>("all");
  const [refund, setRefund] = useState<RefundFilter>("all");
  const [draftRefund, setDraftRefund] = useState<RefundFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshOrdersFromDB = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as { orders?: AdminOrder[] };
      const refreshed = Array.isArray(body.orders) ? body.orders : [];
      const details = getAdminFailedOrderDetails(refreshed);
      setOrders(details);
      setSelectedOrderId((currentId) => {
        const params = new URLSearchParams(window.location.search);
        const requestedOrderId = params.get("orderId");
        return (
          requestedOrderId ??
          currentId ??
          details[0]?.orderId ??
          null
        );
      });
    } catch {
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshOrdersFromDB();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshOrdersFromDB]);

  const reasonOptions = useMemo(() => {
    const reasonCodes = new Set(orders.map((order) => order.reasonCode));

    return [
      { label: "Toate motivele", value: "all" },
      ...[...reasonCodes].map((reasonCode) => ({
        label: adminFailureReasonLabels[reasonCode],
        value: reasonCode,
      })),
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = normalizeSearch(search);

    return orders.filter((order) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeSearch(order.orderId).includes(query) ||
        normalizeSearch(order.customer.name).includes(query) ||
        normalizeSearch(order.clientEmail ?? "").includes(query) ||
        normalizeSearch(order.reasonLabel).includes(query) ||
        normalizeSearch(order.parcelLocation.label).includes(query);

      return (
        matchesSearch &&
        (reason === "all" || order.reasonCode === reason) &&
        (resolution === "all" || order.resolutionStatus === resolution) &&
        (refund === "all" || order.refundStatus === refund) &&
        (priority === "all" || order.priority === priority)
      );
    });
  }, [orders, priority, reason, refund, resolution, search]);

  const selectedOrder =
    orders.find((order) => order.orderId === selectedOrderId) ??
    filteredOrders[0] ??
    null;
  const lockerIncidentCount = orders.filter(
    (order) => order.hasLockerRecoveryIncident,
  ).length;
  const openCount = orders.filter((order) => order.resolutionStatus !== "resolved").length;
  const refundInProgressCount = orders.filter((order) =>
    ["pending", "started"].includes(order.refundStatus),
  ).length;

  const filters: FilterBarItem[] = [
    {
      id: "reason",
      label: "Motiv",
      value: draftReason,
      onChange: (value) => setDraftReason(value as ReasonFilter),
      options: reasonOptions,
    },
    {
      id: "resolution",
      label: "Rezolvare",
      value: draftResolution,
      onChange: (value) => setDraftResolution(value as ResolutionFilter),
      options: [
        { label: "Toate rezolvarile", value: "all" },
        ...failedOrderResolutionOptions.map(([value, label]) => ({
          label,
          value,
        })),
      ],
    },
    {
      id: "refund",
      label: "Rambursare",
      value: draftRefund,
      onChange: (value) => setDraftRefund(value as RefundFilter),
      options: [
        { label: "Toate rambursarile", value: "all" },
        ...failedOrderRefundOptions.map(([value, label]) => ({
          label,
          value,
        })),
      ],
    },
  ];

  function refreshOrders(orderId: string) {
    setSelectedOrderId(orderId);
    void refreshOrdersFromDB();
  }

  function applyFilters() {
    setSearch(draftSearch);
    setReason(draftReason);
    setResolution(draftResolution);
    setRefund(draftRefund);
  }

  async function handleUpdate(
    orderId: string,
    patch: Parameters<typeof updateAdminFailedOrder>[0]["patch"],
    _changeReason: string | null,
  ) {
    void _changeReason;
    setIsSaving(true);

    const dbPatch: Record<string, unknown> = {};
    if (patch.refundStatus !== undefined) {
      dbPatch.refundStatus = patch.refundStatus;
    }
    if (patch.internalNotes !== undefined) {
      dbPatch.internalNotes = patch.internalNotes;
    }

    if (Object.keys(dbPatch).length === 0) {
      setFeedback({
        tone: "success",
        message: "Nu au existat modificări noi de salvat.",
      });
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify(dbPatch),
        },
      );

      if (!response.ok) {
        const body: { error?: string } | null = await response
          .json()
          .catch(() => null);
        setFeedback({
          tone: "error",
          message:
            body?.error ??
            "Incidentul nu a putut fi salvat în baza de date.",
        });
        setIsSaving(false);
        return;
      }

      await refreshOrdersFromDB();
      setFeedback({
        tone: "success",
        message: "Modificările au fost salvate în baza de date.",
      });
    } catch (err) {
      console.error("[admin-failed-orders-view] update failed:", err);
      setFeedback({
        tone: "error",
        message: "Eroare de rețea la salvarea incidentului.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Incidente"
        description="Listă operațională pentru livrări eșuate, rambursări, notificări și rezolvare internă."
        actions={
          lockerIncidentCount > 0 ? (
            <AppButton asChild>
              <Link href="/admin/locker-recoveries">
                Recuperare locker
                <MapPinned className="size-4" />
              </Link>
            </AppButton>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Incidente</p>
            <p className="font-heading text-3xl tracking-tight">{orders.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Deschise</p>
            <p className="font-heading text-3xl tracking-tight">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Recuperări locker</p>
            <p className="font-heading text-3xl tracking-tight">
              {lockerIncidentCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <FilterBar
        searchValue={draftSearch}
        onSearchChange={setDraftSearch}
        searchPlaceholder="Caută după comandă, client, e-mail, motiv sau locație"
        filters={filters}
        onApplyFilters={applyFilters}
        applyLabel="Filtrează"
      />

      <div className="flex flex-wrap items-center gap-2">
        <AppButton
          type="button"
          variant={priority === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setPriority("all")}
        >
          Toate prioritățile
        </AppButton>
        {(["urgent", "high", "normal", "low"] as const).map((priorityValue) => (
          <AppButton
            key={priorityValue}
            type="button"
            variant={priority === priorityValue ? "default" : "outline"}
            size="sm"
            onClick={() => setPriority(priorityValue)}
          >
            {priorityValue === "urgent"
              ? "Urgentă"
              : priorityValue === "high"
                ? "Ridicata"
                : priorityValue === "normal"
                  ? "Normala"
                  : "Scăzută"}
          </AppButton>
        ))}
        {refundInProgressCount > 0 ? (
          <StatusBadge
            label={`${refundInProgressCount} rambursări în curs`}
            tone="warning"
          />
        ) : null}
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-[calc(var(--radius)+0.35rem)] border p-4 text-sm",
            feedback.tone === "success"
              ? "border-success/35 bg-success/10 text-foreground"
              : "border-destructive/35 bg-destructive/10 text-destructive",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <AdminFailedOrdersTable
          orders={filteredOrders}
          selectedOrderId={selectedOrder?.orderId ?? null}
          onSelect={setSelectedOrderId}
        />

        <div className="grid gap-5">
          <Card className="rounded-[calc(var(--radius)+0.5rem)]">
            <CardContent className="grid gap-4 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-warning" />
                <div>
                  <p className="font-medium text-foreground">
                    Reguli operaționale
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Motivul original, ID-ul, clientul și coordonatele istorice
                    rămân doar pentru citire.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Audit activ" tone="success" />
                <StatusBadge label="Client separat" tone="info" />
                <StatusBadge label="Locker urgent semnalat" tone="destructive" />
              </div>
            </CardContent>
          </Card>

          <FailedOrderDetailsPanel
            order={selectedOrder}
            onUpdate={handleUpdate}
            isSaving={isSaving}
          />
        </div>
      </div>
    </section>
  );
}
