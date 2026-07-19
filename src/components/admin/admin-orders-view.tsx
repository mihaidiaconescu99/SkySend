"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { AdminOrderDetailsPanel } from "@/components/admin/admin-order-details-panel";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { FilterBar } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  adminOrderStatusLabels,
  adminPaymentStatusLabels,
  adminRefundStatusLabels,
} from "@/lib/admin-data";
import { cn } from "@/lib/utils";
import type {
  AdminAuditActor,
  AdminOrder,
  AdminOrderEditablePatch,
  AdminPaymentStatus,
  AdminRefundStatus,
} from "@/types/admin";
import type { OrderStatus } from "@/types/domain";
import type { FilterBarItem } from "@/types/ui";

type AdminOrdersViewProps = {
  initialOrders: AdminOrder[];
};

type StatusFilter = "all" | OrderStatus;
type PaymentFilter = "all" | AdminPaymentStatus;
type RefundFilter = "all" | AdminRefundStatus;
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

function formatMoney(value: AdminOrder["price"]) {
  if (!value) {
    return "Indisponibil";
  }

  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: value.currency,
  }).format(value.amountMinor / 100);
}

function formatOrderId(orderId: string) {
  return orderId.split("_").at(-1)?.replace(/^0+/, "") || orderId;
}

function getOrderTone(status: OrderStatus): StatusTone {
  switch (status) {
    case "delivered":
      return "success";
    case "failed":
    case "cancelled":
    case "returned":
      return "destructive";
    case "queued":
    case "scheduled":
      return "warning";
    case "in_flight":
      return "info";
    case "draft":
      return "neutral";
  }
}

function getPaymentTone(status: AdminPaymentStatus): StatusTone {
  if (status === "paid" || status === "refunded") {
    return "success";
  }

  if (status === "failed") {
    return "destructive";
  }

  if (status === "pending" || status === "authorized" || status === "processing" || status === "refund_pending") {
    return "warning";
  }

  return "neutral";
}

function getRefundTone(status: AdminRefundStatus): StatusTone {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed") {
    return "destructive";
  }

  if (status === "pending" || status === "started") {
    return "warning";
  }

  return "neutral";
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

export function AdminOrdersView({ initialOrders }: AdminOrdersViewProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrders[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [draftPayment, setDraftPayment] = useState<PaymentFilter>("all");
  const [refund, setRefund] = useState<RefundFilter>("all");
  const [draftRefund, setDraftRefund] = useState<RefundFilter>("all");
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

      setOrders(refreshed);
      setSelectedOrderId((currentId) => {
        const params = new URLSearchParams(window.location.search);
        const requestedOrderId = params.get("orderId");
        return (
          requestedOrderId ??
          currentId ??
          refreshed[0]?.id ??
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

  const filteredOrders = useMemo(() => {
    const query = normalizeSearch(search);

    return orders.filter((order) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeSearch(order.id).includes(query) ||
        normalizeSearch(order.customer.name).includes(query) ||
        normalizeSearch(order.customer.email ?? "").includes(query) ||
        normalizeSearch(order.pickup?.label ?? "").includes(query) ||
        normalizeSearch(order.dropoff?.label ?? "").includes(query);

      return (
        matchesSearch &&
        (status === "all" || order.status === status) &&
        (payment === "all" || order.payment.status === payment) &&
        (refund === "all" || order.refund.status === refund)
      );
    });
  }, [orders, payment, refund, search, status]);

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ??
    filteredOrders[0] ??
    null;
  const activeOrdersCount = orders.filter((order) =>
    ["scheduled", "queued", "in_flight"].includes(order.status),
  ).length;
  const failedOrdersCount = orders.filter((order) => order.status === "failed").length;
  const auditEventCount = orders.reduce(
    (count, order) => count + order.auditTrail.length,
    0,
  );

  const filters: FilterBarItem[] = [
    {
      id: "status",
      label: "Status",
      value: draftStatus,
      onChange: (value) => setDraftStatus(value as StatusFilter),
      options: [
        { label: "Toate statusurile", value: "all" },
        ...Object.entries(adminOrderStatusLabels).map(([value, label]) => ({
          label,
          value,
        })),
      ],
    },
    {
      id: "payment",
      label: "Plată",
      value: draftPayment,
      onChange: (value) => setDraftPayment(value as PaymentFilter),
      options: [
        { label: "Toate platile", value: "all" },
        ...Object.entries(adminPaymentStatusLabels).map(([value, label]) => ({
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
        ...Object.entries(adminRefundStatusLabels).map(([value, label]) => ({
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
    setStatus(draftStatus);
    setPayment(draftPayment);
    setRefund(draftRefund);
  }

  async function handleSave(
    orderId: string,
    patch: AdminOrderEditablePatch,
    _reason: string | null,
  ) {
    void _reason;
    setIsSaving(true);

    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.paymentStatus !== undefined)
      dbPatch.paymentStatus = patch.paymentStatus;
    if (patch.refundStatus !== undefined)
      dbPatch.refundStatus = patch.refundStatus;
    if (patch.internalNotes !== undefined)
      dbPatch.internalNotes = patch.internalNotes;

    if (Object.keys(dbPatch).length === 0) {
      setFeedback({
        tone: "success",
        message: "Nu au existat modificări noi de salvat.",
      });
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(dbPatch),
      });

      if (!response.ok) {
        const body: { error?: string } | null = await response
          .json()
          .catch(() => null);
        setFeedback({
          tone: "error",
          message:
            body?.error ??
            "Modificările nu au putut fi salvate în baza de date.",
        });
        setIsSaving(false);
        return;
      }

      const body = (await response.json()) as { order?: AdminOrder };
      if (body.order) {
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? body.order! : order)),
        );
        setSelectedOrderId(orderId);
      } else {
        await refreshOrdersFromDB();
      }

      setFeedback({
        tone: "success",
        message: "Modificările au fost salvate în baza de date.",
      });

      router.refresh();
    } catch (err) {
      console.error("[admin-orders-view] save failed:", err);
      setFeedback({
        tone: "error",
        message: "Eroare de rețea la salvarea modificărilor.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Comenzi"
        description="Administrare operațională pentru statusuri, colet, plată, rambursare, puncte de întâlnire și note interne."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Comenzi totale</p>
            <p className="font-heading text-3xl tracking-tight">{orders.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Comenzi active</p>
            <p className="font-heading text-3xl tracking-tight">{activeOrdersCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Evenimente audit</p>
            <p className="font-heading text-3xl tracking-tight">{auditEventCount}</p>
          </CardContent>
        </Card>
      </div>

      <FilterBar
        searchValue={draftSearch}
        onSearchChange={setDraftSearch}
        searchPlaceholder="Caută după comandă, client, e-mail sau rută"
        filters={filters}
        onApplyFilters={applyFilters}
        applyLabel="Filtrează"
      />

      <div className="flex flex-wrap items-center gap-2">
        {failedOrdersCount > 0 ? (
          <StatusBadge label={`${failedOrdersCount} incidente`} tone="warning" />
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
        <Card className="rounded-[calc(var(--radius)+0.5rem)]">
          <CardContent className="grid gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">Tabel comenzi</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filteredOrders.length} comenzi vizibile după filtre.
                </p>
              </div>
              <ClipboardList className="size-5 text-muted-foreground" />
            </div>

            <div className="hidden overflow-x-auto rounded-[calc(var(--radius)+0.35rem)] border border-border/75 lg:block">
              <table className="w-full min-w-[72rem]">
                <thead className="bg-secondary/45 text-left">
                  <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-4">Comandă</th>
                    <th className="px-4 py-4">Client</th>
                    <th className="px-4 py-4">Ruta</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Plată</th>
                    <th className="px-4 py-4">Rambursare</th>
                    <th className="px-4 py-4">Preț</th>
                    <th className="px-4 py-4">Actualizat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const isSelected = selectedOrder?.id === order.id;

                    return (
                      <tr
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedOrderId(order.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedOrderId(order.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-t border-border/75 bg-card transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                          isSelected && "bg-primary/6",
                        )}
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="grid gap-2">
                            <p className="font-medium text-foreground">
                              {formatOrderId(order.id)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <p className="font-medium text-foreground">
                            {order.customer.name}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {order.customer.email ?? "E-mail indisponibil"}
                          </p>
                        </td>
                        <td className="max-w-[18rem] px-4 py-4 align-top text-sm">
                          <p className="truncate text-foreground">
                            {order.pickup?.label ?? "Ridicare indisponibilă"}
                          </p>
                          <p className="mt-1 truncate text-muted-foreground">
                            către {order.dropoff?.label ?? "livrare indisponibilă"}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge label={order.statusLabel} tone={getOrderTone(order.status)} />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge label={order.payment.statusLabel} tone={getPaymentTone(order.payment.status)} />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge label={order.refund.statusLabel} tone={getRefundTone(order.refund.status)} />
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                          {formatMoney(order.price)}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                          {formatDateTime(order.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;

                return (
                  <Card
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedOrderId(order.id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-[calc(var(--radius)+0.375rem)] transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                      isSelected && "border-primary/50",
                    )}
                  >
                    <CardContent className="grid gap-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatOrderId(order.id)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.customer.name}
                          </p>
                        </div>
                        <StatusBadge label={order.statusLabel} tone={getOrderTone(order.status)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={order.payment.statusLabel} tone={getPaymentTone(order.payment.status)} />
                        <StatusBadge label={order.refund.statusLabel} tone={getRefundTone(order.refund.status)} />
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {order.pickup?.label ?? "Ridicare indisponibilă"} către{" "}
                        {order.dropoff?.label ?? "livrare indisponibilă"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-5 text-sm leading-6 text-muted-foreground">
                Nu există comenzi pentru filtrele curente.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="rounded-[calc(var(--radius)+0.5rem)]">
            <CardContent className="grid gap-4 p-5">
              <div className="flex items-center gap-3">
                <PackageCheck className="size-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Context operațional</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Detaliile comenzii selectate se salvează în baza de date.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Câmpuri doar citire" tone="neutral" />
                <StatusBadge label="Audit activ" tone="success" />
                <StatusBadge label="Date din comenzi locale" tone="info" />
              </div>
            </CardContent>
          </Card>

          <AdminOrderDetailsPanel
            order={selectedOrder}
            actor={adminActor}
            onSave={handleSave}
            isSaving={isSaving}
          />

          <Card className="rounded-[calc(var(--radius)+0.5rem)]">
            <CardContent className="grid gap-3 p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="size-5 text-warning" />
                <p className="font-medium text-foreground">Reguli de editare</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                ID-ul, clientul, e-mailul, data creării și audit-ul sunt doar
                pentru citire. Pentru coordonate se păstrează valorile existente
                până există un editor sigur.
              </p>
              <AppButton asChild variant="outline" size="sm" className="w-fit">
                <a href="#top">
                  Inapoi sus
                  <ArrowRight className="size-4" />
                </a>
              </AppButton>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
