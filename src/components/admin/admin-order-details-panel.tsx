"use client";

import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  FileClock,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { AdminBillingDocuments } from "@/components/admin/admin-billing-documents";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminOrderStatusLabels,
  adminResolutionStatusLabels,
} from "@/lib/admin-data";
import { cn } from "@/lib/utils";
import type {
  AdminAuditActor,
  AdminOrder,
  AdminOrderEditablePatch,
  AdminPaymentStatus,
  AdminResolutionStatus,
} from "@/types/admin";
import type { Json } from "@/types/database";
import type { OrderStatus } from "@/types/domain";

type AdminOrderDetailsPanelProps = {
  order: AdminOrder | null;
  actor: AdminAuditActor;
  onSave: (
    orderId: string,
    patch: AdminOrderEditablePatch,
    reason: string | null,
  ) => void;
  isSaving?: boolean;
};

type FormDraft = {
  status: OrderStatus;
  resolutionStatus: AdminResolutionStatus | "";
  internalNotes: string;
  changeReason: string;
};

type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

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

function toDraft(order: AdminOrder): FormDraft {
  return {
    status: order.status,
    resolutionStatus: order.resolutionStatus ?? "",
    internalNotes: order.internalNotes ?? "",
    changeReason: "",
  };
}

function formatAuditValue(value: Json) {
  if (value === null) {
    return "gol";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

const auditFieldLabels: Record<string, string> = {
  status: "Status operațional",
  parcelStatus: "Status colet",
  meetingPoints: "Punct de întâlnire",
  estimatedWeightKg: "Greutate estimată",
  detectedWeightKg: "Greutate detectată",
  dimensionsCm: "Dimensiuni",
  price: "Preț",
  paymentStatus: "Status plată",
  refundStatus: "Status rambursare",
  refundReason: "Motiv rambursare",
  internalNotes: "Note interne",
  failureReasonCode: "Cod eșec",
  failureReasonLabel: "Motiv eșec",
  resolutionStatus: "Status rezolvare",
  customerNotificationStatus: "Status notificare client",
};

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function AdminOrderDetailsPanel({
  order,
  actor,
  onSave,
  isSaving,
}: AdminOrderDetailsPanelProps) {
  if (!order) {
    return (
      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="p-5 text-sm leading-6 text-muted-foreground">
          Selectează o comandă pentru detalii și editare.
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminOrderDetailsPanelContent
      key={`${order.id}:${order.updatedAt}:${order.auditTrail.length}`}
      order={order}
      actor={actor}
      onSave={onSave}
      isSaving={Boolean(isSaving)}
    />
  );
}

type AdminOrderDetailsPanelContentProps = {
  order: AdminOrder;
  actor: AdminAuditActor;
  onSave: (
    orderId: string,
    patch: AdminOrderEditablePatch,
    reason: string | null,
  ) => void;
  isSaving: boolean;
};

function AdminOrderDetailsPanelContent({
  order,
  onSave,
  isSaving,
}: AdminOrderDetailsPanelContentProps) {
  const [draft, setDraft] = useState<FormDraft>(() => toDraft(order));
  const [error, setError] = useState<string | null>(null);

  function updateDraft<Key extends keyof FormDraft>(key: Key, value: FormDraft[Key]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  }

  function buildPatch(): AdminOrderEditablePatch | null {
    setError(null);

    return {
      status: draft.status,
      resolutionStatus: draft.resolutionStatus || null,
      internalNotes: draft.internalNotes.trim() || null,
    };
  }

  function handleSubmit() {
    const patch = buildPatch();

    if (!patch) {
      return;
    }

    onSave(order.id, patch, draft.changeReason.trim() || null);
  }

  async function handleQuickAction(action: "failed" | "cancelled" | "refund_started" | "refund_completed") {
    if (action === "refund_started") {
      const reason = window.prompt("Motivul obligatoriu al rambursării:")?.trim();
      if (!reason) return;
      if (
        !window.confirm(
          "Confirmi rambursarea integrală a sumei eligibile rămase?",
        )
      ) {
        return;
      }
      onSave(order.id, { refundStatus: "started" }, reason);
      return;
    }
    if (action === "refund_completed") {
      setError("Statusul reușit poate fi confirmat numai de webhook-ul Stripe.");
      return;
    }
    if (action === "failed" && order.status === "delivered") {
      setError("O comandă livrată nu poate fi marcată eșuată din această pagină.");
      return;
    }

    if (action === "cancelled" && order.status === "delivered") {
      setError("O comandă livrată nu poate fi anulată din această pagină.");
      return;
    }

    const confirmed = window.confirm(
      action === "failed"
        ? "Confirma marcarea comenzii ca esuata?"
        : action === "cancelled"
          ? "Confirma anularea comenzii?"
          : action === "refund_started"
            ? "Confirma marcarea rambursarii ca in curs?"
            : "Confirma marcarea rambursarii ca finalizata?",
    );

    if (!confirmed) {
      return;
    }

    const quickPatch: AdminOrderEditablePatch =
      action === "failed"
        ? {
            status: "failed",
            failureReasonCode: "unknown",
            failureReasonLabel:
              "Comandă marcată manual ca eșuată.",
            resolutionStatus: "open",
          }
        : action === "cancelled"
          ? {
              status: "cancelled",
            failureReasonCode: "system_cancelled",
            failureReasonLabel:
              "Comandă anulată manual din admin.",
              resolutionStatus: "open",
            }
          : action === "refund_started"
            ? {
                refundStatus: "started",
                paymentStatus: "refund_pending",
              }
            : {
                refundStatus: "completed",
                paymentStatus: "refunded",
                resolutionStatus: order.resolutionStatus ?? "resolved",
              };

    onSave(
      order.id,
      quickPatch,
      draft.changeReason.trim() ||
        (action === "failed"
          ? "Comandă marcată eșuată din panoul admin."
          : action === "cancelled"
            ? "Comandă anulată din panoul admin."
            : "Rambursare actualizată din panoul admin."),
    );
  }

  return (
    <div className="grid gap-5">
      <AdminBillingDocuments orderId={order.id} />
      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-heading text-xl tracking-tight text-foreground">
                Comanda {formatOrderId(order.id)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.customer.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={order.statusLabel} tone={getOrderTone(order.status)} />
              <StatusBadge label={order.payment.statusLabel} tone={getPaymentTone(order.payment.status)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyItem label="ID comandă" value={order.id} />
            <ReadOnlyItem label="Sursă date" value={order.source === "runtime_local" ? "Comandă locală" : order.source} />
            <ReadOnlyItem label="E-mail client" value={order.customer.email ?? "Indisponibil"} />
            <ReadOnlyItem label="Creat la" value={formatDateTime(order.createdAt)} />
          </div>

          <div className="grid gap-3">
            <ReadOnlyItem label="Ridicare" value={order.pickup?.label ?? "Indisponibil"} />
            <ReadOnlyItem label="Livrare" value={order.dropoff?.label ?? "Indisponibil"} />
            <ReadOnlyItem
              label="Coordonate punct întâlnire"
              value={
                order.meetingPoints.active?.coordinates
                  ? `${order.meetingPoints.active.coordinates.latitude.toFixed(5)}, ${order.meetingPoints.active.coordinates.longitude.toFixed(5)}`
                  : "Indisponibil"
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div>
            <p className="font-medium text-foreground">Editare comandă</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Câmpurile doar citire rămân blocate; modificările salvate intră în audit.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Status operațional"
              value={draft.status}
              onChange={(value) => updateDraft("status", value as OrderStatus)}
              options={Object.entries(adminOrderStatusLabels)}
            />
            <SelectField
              label="Status rezolvare"
              value={draft.resolutionStatus}
              onChange={(value) =>
                updateDraft("resolutionStatus", value as AdminResolutionStatus | "")
              }
              options={[
                ["", "Fara status de rezolvare"],
                ...(Object.entries(adminResolutionStatusLabels) as Array<
                  [AdminResolutionStatus, string]
                >),
              ]}
            />
          </div>

          <label className="grid gap-2">
            <FieldLabel>Note interne</FieldLabel>
            <textarea
              value={draft.internalNotes}
              onChange={(event) => updateDraft("internalNotes", event.target.value)}
              rows={4}
              className="min-h-28 w-full rounded-2xl border border-input bg-muted px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>

          <label className="grid gap-2">
            <FieldLabel>Motiv modificare</FieldLabel>
            <Input
              value={draft.changeReason}
              onChange={(event) => updateDraft("changeReason", event.target.value)}
              placeholder="Opțional, apare în audit"
            />
          </label>

          {error ? (
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <AppButton type="button" onClick={handleSubmit} disabled={isSaving}>
              <Save className="size-4" />
              Salvează modificările
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => setDraft(toDraft(order))}
              disabled={isSaving}
            >
              <RotateCcw className="size-4" />
              Reseteaza formularul
            </AppButton>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-4 p-5">
          <div>
            <p className="font-medium text-foreground">Acțiuni rapide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acțiunile importante cer confirmare și sunt scrise în audit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="outline"
              onClick={() => handleQuickAction("failed")}
              disabled={isSaving || order.status === "delivered"}
            >
              <XCircle className="size-4" />
              Marcheaza esuata
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => handleQuickAction("cancelled")}
              disabled={isSaving || order.status === "delivered"}
            >
              <Ban className="size-4" />
              Anuleaza
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => handleQuickAction("refund_started")}
              disabled={isSaving}
            >
              <CircleDollarSign className="size-4" />
              Marchează rambursare în curs
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={() => handleQuickAction("refund_completed")}
              disabled={isSaving}
            >
              <CheckCircle2 className="size-4" />
              Marchează rambursare finalizată
            </AppButton>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-center gap-3">
            <FileClock className="size-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Istoric modificări</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Audit-ul este doar pentru citire.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {order.auditTrail.map((event) => (
              <div
                key={event.id}
                className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {auditFieldLabels[event.field] ?? event.field}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {event.actorName ?? event.actorId} a schimbat valoarea din{" "}
                  <span className="text-foreground">{formatAuditValue(event.oldValue)}</span>{" "}
                  in{" "}
                  <span className="text-foreground">{formatAuditValue(event.newValue)}</span>
                  {event.reason ? ` pentru: ${event.reason}` : "."}
                </p>
              </div>
            ))}

            {order.auditTrail.length === 0 ? (
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground">
                Nu există modificări administrative salvate pentru această comandă.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
