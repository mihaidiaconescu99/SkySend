"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPinned,
  PackageCheck,
  ShieldAlert,
  Truck,
  UserRound,
  Weight,
} from "lucide-react";
import { activeHub } from "@/constants/hub";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { AppButton } from "@/components/shared/app-button";
import { FilterBar } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAdminLockerRecoveryDetails,
  lockerRecoveryStatusOptions,
  updateAdminLockerRecovery,
} from "@/lib/admin-locker-recoveries";
import { getMarkerDrivenViewport, getServiceAreaMapOverlay } from "@/lib/map";
import { cn } from "@/lib/utils";
import type { AdminAuditActor, LockerRecoveryStatus } from "@/types/admin";
import type {
  AdminLockerRecoveryDetail,
  AdminLockerRecoveryUpdatePatch,
} from "@/types/admin-locker-recoveries";
import type { MapMarkerDefinition } from "@/types/map";
import type { FilterBarItem } from "@/types/ui";

type AdminLockerRecoveriesViewProps = {
  initialRecoveries: AdminLockerRecoveryDetail[];
};

type StatusFilter = "all" | LockerRecoveryStatus;
type OperatorFilter = "all" | "assigned" | "unassigned";
type CoordinateFilter = "all" | AdminLockerRecoveryDetail["dataCompleteness"];
type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

const adminActor: AdminAuditActor = {
  actorId: "admin-local",
  actorRole: "admin",
  actorName: "Panou Administrator",
};

const statusOrder: LockerRecoveryStatus[] = [
  "locker_detached",
  "operator_dispatched",
  "locker_recovered",
  "parcel_returned_to_hub",
  "customer_notified",
  "resolved",
];

const serviceAreaOverlays = [getServiceAreaMapOverlay()] as const;

const dataCompletenessLabels: Record<
  AdminLockerRecoveryDetail["dataCompleteness"],
  string
> = {
  exact: "Coordonate exacte",
  partial: "Locație textuală",
  missing_coordinates: "Fara coordonate",
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

function formatCoordinates(incident: AdminLockerRecoveryDetail) {
  if (!incident.coordinates) {
    return "Coordonate indisponibile";
  }

  return `${incident.coordinates.latitude.toFixed(5)}, ${incident.coordinates.longitude.toFixed(5)}`;
}

function formatWeight(value: number | null) {
  if (value === null) {
    return "Indisponibil";
  }

  return `${value.toLocaleString("ro-RO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  })} kg`;
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) {
    return "Indisponibil";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

function getStatusTone(status: LockerRecoveryStatus): StatusTone {
  switch (status) {
    case "locker_detached":
      return "destructive";
    case "operator_dispatched":
    case "locker_recovered":
    case "parcel_returned_to_hub":
      return "warning";
    case "customer_notified":
    case "resolved":
      return "success";
  }
}

function getPriorityTone(priority: AdminLockerRecoveryDetail["priority"]): StatusTone {
  return priority === "urgent" ? "destructive" : "warning";
}

function getStatusIndex(status: LockerRecoveryStatus) {
  return statusOrder.indexOf(status);
}

function LockerRecoveryAlertHeader({
  recoveries,
}: {
  recoveries: AdminLockerRecoveryDetail[];
}) {
  const activeCount = recoveries.filter((incident) => !incident.isResolved).length;
  const missingCoordinatesCount = recoveries.filter(
    (incident) => !incident.coordinates,
  ).length;
  const assignedCount = recoveries.filter(
    (incident) => incident.assignedOperatorName,
  ).length;

  return (
    <section className="rounded-[calc(var(--radius)+0.625rem)] border border-destructive/35 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--destructive)_18%,transparent),color-mix(in_srgb,var(--warning)_10%,transparent))] p-5 shadow-[var(--elevation-soft)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-2xl tracking-tight text-foreground">
              Recuperare urgentă necesară
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Cazurile de greutate depășită sunt incidente urgente: lockerul rămâne
              securizat la sol, drona pleacă, iar un operator SkySend trebuie să
              recupereze fizic lockerul de la locația afișată.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-destructive/25 bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 font-heading text-3xl tracking-tight">
              {activeCount}
            </p>
          </div>
          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Operator atribuit</p>
            <p className="mt-1 font-heading text-3xl tracking-tight">
              {assignedCount}
            </p>
          </div>
          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-warning/35 bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Fără coordonate</p>
            <p className="mt-1 font-heading text-3xl tracking-tight">
              {missingCoordinatesCount}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LockerRecoveryMap({
  recoveries,
  selectedIncidentId,
  onSelect,
}: {
  recoveries: AdminLockerRecoveryDetail[];
  selectedIncidentId: string | null;
  onSelect: (incidentId: string) => void;
}) {
  const selectedIncident =
    recoveries.find((incident) => incident.id === selectedIncidentId) ?? null;
  const recoveriesWithCoordinates = recoveries.filter(
    (incident) => incident.coordinates,
  );
  const lockerMarkers: MapMarkerDefinition[] = recoveriesWithCoordinates
    .filter((incident) => incident.coordinates)
    .map((incident) => ({
      id: `locker_${incident.id}`,
      point: incident.coordinates!,
      label: `Locker ${formatOrderId(incident.lockerId)}`,
      description: incident.exactLocation ?? "Locație locker",
      kind: "unavailable",
      tone: "destructive",
      variant: "unavailable",
      selected: selectedIncidentId === incident.id,
      emphasized: !incident.isResolved,
      onClick: () => onSelect(incident.id),
    }));
  const markers: MapMarkerDefinition[] = [
    {
      id: "locker-recovery-hub",
      point: activeHub.address.location,
      label: activeHub.name,
      description: activeHub.address.formattedAddress,
      kind: "warehouse",
      tone: "warehouse",
      variant: "hub",
    },
    ...lockerMarkers,
  ];
  const viewport = getMarkerDrivenViewport(markers);

  return (
    <div className="relative h-[28rem] min-h-[28rem] overflow-hidden rounded-[calc(var(--radius)+0.625rem)] border border-border/75 bg-card shadow-[var(--elevation-soft)]">
      <LazyMapContainer
        className="h-[28rem] min-h-[28rem] rounded-none border-0 shadow-none"
        ariaLabel="Harta recuperărilor de locker"
        center={viewport.center}
        zoom={viewport.zoom}
        interactive
        showNavigation
        markers={markers}
        overlays={serviceAreaOverlays}
        selectedPoint={selectedIncident?.coordinates ?? null}
        overlayContent={
          <div className="map-overlay-card max-w-[calc(100vw-2rem)] sm:max-w-md">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-destructive motion-safe:animate-pulse" />
              <p className="type-caption">Recuperări locker</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                label={`${recoveriesWithCoordinates.length} marcate pe hartă`}
                tone="destructive"
              />
              {selectedIncident ? (
                <StatusBadge
                  label={selectedIncident.statusLabel}
                  tone={getStatusTone(selectedIncident.status)}
                />
              ) : null}
            </div>
          </div>
        }
      />

      {selectedIncident?.coordinates ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[calc(var(--radius)+0.35rem)] border border-destructive/35 bg-background/92 p-3 text-sm text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur md:left-auto md:max-w-sm">
          <p className="font-medium text-foreground">
            Locker selectat: {formatOrderId(selectedIncident.lockerId)}
          </p>
          <p className="mt-1">
            {selectedIncident.exactLocation ?? "Locație textuală indisponibilă"}
          </p>
          <p className="mt-1 font-mono text-xs">
            {formatCoordinates(selectedIncident)}
          </p>
        </div>
      ) : selectedIncident ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[calc(var(--radius)+0.35rem)] border border-warning/40 bg-background/92 p-3 text-sm text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur md:left-auto md:max-w-sm">
          Harta nu poate marca lockerul selectat fără coordonate. Folosește locația
          textuală din detalii pentru intervenție.
        </div>
      ) : recoveries.length === 0 ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background/92 p-3 text-sm text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur md:left-auto md:max-w-sm">
          Nu există recuperări de locker de afișat pe hartă.
        </div>
      ) : null}
    </div>
  );
}

function EmptyLockerRecoveryState() {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-6 text-center">
        <div className="mx-auto rounded-full bg-success/10 p-3 text-success">
          <CheckCircle2 className="size-6" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Nu există recuperări pentru filtrele curente
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ajustează căutarea sau filtrele pentru a vedea incidentele existente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LockerRecoveryTable({
  recoveries,
  selectedIncidentId,
  onSelect,
}: {
  recoveries: AdminLockerRecoveryDetail[];
  selectedIncidentId: string | null;
  onSelect: (incidentId: string) => void;
}) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">
              Incidente recuperare locker
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recoveries.length} înregistrări după filtre.
            </p>
          </div>
          <MapPinned className="size-5 text-destructive" />
        </div>

        <div className="hidden overflow-x-auto rounded-[calc(var(--radius)+0.35rem)] border border-border/75 xl:block">
          <table className="w-full min-w-[70rem]">
            <thead className="bg-secondary/45 text-left">
              <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-4">Locker</th>
                <th className="px-4 py-4">Comandă</th>
                <th className="px-4 py-4">Locație exactă</th>
                <th className="px-4 py-4">Greutate</th>
                <th className="px-4 py-4">Timp pe teren</th>
                <th className="px-4 py-4">Operator</th>
                <th className="px-4 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {recoveries.map((incident) => {
                const isSelected = selectedIncidentId === incident.id;

                return (
                  <tr
                    key={incident.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(incident.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(incident.id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-border/75 bg-card transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70",
                      isSelected && "bg-primary/6",
                      !incident.isResolved && "bg-destructive/4",
                    )}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-foreground">
                        {formatOrderId(incident.lockerId)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dataCompletenessLabels[incident.dataCompleteness]}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-foreground">
                        {formatOrderId(incident.orderId)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {incident.customer.email ?? "E-mail indisponibil"}
                      </p>
                    </td>
                    <td className="max-w-[20rem] px-4 py-4 align-top text-sm">
                      <p className="truncate font-medium text-foreground">
                        {incident.exactLocation ?? "Locație textuală lipsă"}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {formatCoordinates(incident)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      <p>Detectata: {formatWeight(incident.detectedWeightKg)}</p>
                      <p className="mt-1">Limita: {formatWeight(incident.limitKg)}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      {formatMinutes(incident.minutesOnField)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <p className="font-medium text-foreground">
                        {incident.assignedOperatorName ?? "Neatribuit"}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge
                        label={incident.statusLabel}
                        tone={getStatusTone(incident.status)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 xl:hidden">
          {recoveries.map((incident) => {
            const isSelected = selectedIncidentId === incident.id;

            return (
              <Card
                key={incident.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(incident.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(incident.id);
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-[calc(var(--radius)+0.375rem)] transition-colors hover:border-primary/35 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  isSelected && "border-primary/50",
                  !incident.isResolved && "border-destructive/35",
                )}
              >
                <CardContent className="grid gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        Locker {formatOrderId(incident.lockerId)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Comanda {formatOrderId(incident.orderId)}
                      </p>
                    </div>
                    <StatusBadge
                      label={incident.priority === "urgent" ? "Urgent" : "Ridicat"}
                      tone={getPriorityTone(incident.priority)}
                    />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {incident.exactLocation ?? "Locație textuală lipsă"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={incident.statusLabel}
                      tone={getStatusTone(incident.status)}
                    />
                    <StatusBadge
                      label={dataCompletenessLabels[incident.dataCompleteness]}
                      tone={incident.coordinates ? "info" : "warning"}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {recoveries.length === 0 ? <EmptyLockerRecoveryState /> : null}
      </CardContent>
    </Card>
  );
}

function LockerRecoveryStatusStepper({
  incident,
}: {
  incident: AdminLockerRecoveryDetail;
}) {
  const currentIndex = getStatusIndex(incident.status);

  return (
    <div className="grid gap-3">
      {lockerRecoveryStatusOptions.map(([status, label], index) => {
        const isCurrent = status === incident.status;
        const isComplete = currentIndex >= index;

        return (
          <div
            key={status}
            className="flex gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-3"
          >
            <div
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !isCurrent && isComplete && "border-success bg-success/15 text-success",
                !isCurrent && !isComplete && "border-border text-muted-foreground",
              )}
            >
              {isComplete ? <CheckCircle2 className="size-3.5" /> : index + 1}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isCurrent
                  ? "Status curent"
                  : isComplete
                    ? "Etapă parcursă"
                    : "Etapă următoare"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LockerRecoveryDetailsPanel({
  incident,
  onUpdate,
  isSaving,
}: {
  incident: AdminLockerRecoveryDetail | null;
  onUpdate: (
    incidentId: string,
    patch: AdminLockerRecoveryUpdatePatch,
    reason: string | null,
  ) => void;
  isSaving: boolean;
}) {
  if (!incident) {
    return (
      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="p-5 text-sm leading-6 text-muted-foreground">
          Selectează un incident pentru locația exactă și acțiunile de recuperare.
        </CardContent>
      </Card>
    );
  }

  return (
    <LockerRecoveryDetailsPanelContent
      key={`${incident.id}:${incident.updatedAt}:${incident.status}`}
      incident={incident}
      onUpdate={onUpdate}
      isSaving={isSaving}
    />
  );
}

function LockerRecoveryDetailsPanelContent({
  incident,
  onUpdate,
  isSaving,
}: {
  incident: AdminLockerRecoveryDetail;
  onUpdate: (
    incidentId: string,
    patch: AdminLockerRecoveryUpdatePatch,
    reason: string | null,
  ) => void;
  isSaving: boolean;
}) {
  const [operatorName, setOperatorName] = useState(
    incident.assignedOperatorName ?? "",
  );
  const [internalNote, setInternalNote] = useState(incident.internalNote ?? "");
  const [clientNotified, setClientNotified] = useState(incident.clientNotified);
  const [reason, setReason] = useState("");

  function updateStatus(status: LockerRecoveryStatus) {
    const patch: AdminLockerRecoveryUpdatePatch = { status };

    if (status === "customer_notified" || status === "resolved") {
      patch.clientNotified = true;
    }

    onUpdate(
      incident.id,
      patch,
      reason.trim() || `Status recuperare setat la ${lockerRecoveryStatusOptions.find(([value]) => value === status)?.[1]}.`,
    );
  }

  function saveOperationalDetails() {
    onUpdate(
      incident.id,
      {
        assignedOperatorId: null,
        assignedOperatorName: operatorName.trim() || null,
        internalNote: internalNote.trim() || null,
        clientNotified,
      },
      reason.trim() || "Detaliile operaționale ale recuperării au fost actualizate.",
    );
  }

  return (
    <div className="grid gap-5">
      <Card className="rounded-[calc(var(--radius)+0.5rem)] border-destructive/30 bg-destructive/5">
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-heading text-xl tracking-tight text-foreground">
                Locker {formatOrderId(incident.lockerId)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Comanda {formatOrderId(incident.orderId)} /{" "}
                {incident.customer.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={incident.priority === "urgent" ? "Urgent" : "Ridicat"}
                tone={getPriorityTone(incident.priority)}
              />
              <StatusBadge
                label={incident.statusLabel}
                tone={getStatusTone(incident.status)}
              />
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)+0.35rem)] border border-destructive/25 bg-background/75 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-foreground">
                  Incident urgent, nu doar comandă eșuată
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Lockerul a rămas securizat la sol după decuplare. Drona nu
                  transportă lockerul mai departe, iar recuperarea fizică trebuie
                  coordonată din această secțiune.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background p-4">
              <p className="text-xs text-muted-foreground">Locație exactă</p>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {incident.exactLocation ?? "Locație textuală indisponibilă"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatCoordinates(incident)}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background p-4">
              <p className="text-xs text-muted-foreground">Punct întâlnire</p>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {incident.meetingPoint?.label ?? "Punct indisponibil"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {dataCompletenessLabels[incident.dataCompleteness]}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Weight className="size-4" />
                Greutate detectată
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatWeight(incident.detectedWeightKg)}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PackageCheck className="size-4" />
                Limită dronă
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatWeight(incident.limitKg)}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-4" />
                Timp pe teren
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatMinutes(incident.minutesOnField)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AppButton asChild variant="outline" size="sm">
              <Link href={incident.orderHref}>
                Comandă
                <ArrowRight className="size-4" />
              </Link>
            </AppButton>
            <AppButton asChild variant="outline" size="sm">
              <Link href={incident.failedOrderHref}>
                Incident
                <ArrowRight className="size-4" />
              </Link>
            </AppButton>
            {incident.googleMapsHref ? (
              <AppButton asChild size="sm">
                <a
                  href={incident.googleMapsHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deschide harta externă
                  <ExternalLink className="size-4" />
                </a>
              </AppButton>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div>
            <p className="font-medium text-foreground">Acțiuni recuperare</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Operatorul, nota internă și statusul se salvează local și sunt
              reflectate în Privirea generală.
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

          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Nume operator
              </span>
              <input
                value={operatorName}
                onChange={(event) => setOperatorName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="Operator teren"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notă internă
            </span>
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              rows={4}
              className="min-h-28 w-full rounded-2xl border border-input bg-muted px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
              placeholder="Detalii pentru operatorul de teren"
            />
          </label>

          <label className="flex items-center gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4 text-sm text-foreground">
            <input
              type="checkbox"
              checked={clientNotified}
              onChange={(event) => setClientNotified(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Client notificat manual despre recuperarea lockerului.
          </label>

          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="outline"
              onClick={saveOperationalDetails}
              disabled={isSaving}
            >
              <UserRound className="size-4" />
              Salvează detalii
            </AppButton>
            {lockerRecoveryStatusOptions.map(([status, label]) => (
              <AppButton
                key={status}
                type="button"
                variant={incident.status === status ? "default" : "outline"}
                onClick={() => updateStatus(status)}
                disabled={isSaving || incident.status === status}
              >
                {status === "operator_dispatched" ? (
                  <Truck className="size-4" />
                ) : status === "resolved" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                {label}
              </AppButton>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div className="flex items-center gap-3">
            <LocateFixed className="size-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Date doar citire</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ID-ul lockerului, comanda, coordonatele detectate și motivul
                decuplării nu se editează manual.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">ID locker</p>
              <p className="mt-2 break-all text-sm font-medium text-foreground">
                {incident.lockerId}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">ID comandă</p>
              <p className="mt-2 break-all text-sm font-medium text-foreground">
                {incident.orderId}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">Data detașării</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatDateTime(incident.detachedAt)}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4">
              <p className="text-xs text-muted-foreground">Motiv decuplare</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Greutate peste limită / recuperare fizică necesară
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-5 p-5">
          <div>
            <p className="font-medium text-foreground">Status recuperare</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapele sunt operaționale și rămân vizibile în istoricul incidentului.
            </p>
          </div>
          <LockerRecoveryStatusStepper incident={incident} />
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="size-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Istoric status</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {incident.statusHistory.length} evenimente pentru recuperare.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {incident.statusHistory.map((event) => (
              <div
                key={event.id}
                className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge
                    label={event.statusLabel}
                    tone={getStatusTone(event.status)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {event.actorName ?? event.actorId}
                  {event.note ? ` / ${event.note}` : ""}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminLockerRecoveriesView({
  initialRecoveries,
}: AdminLockerRecoveriesViewProps) {
  const [recoveries, setRecoveries] = useState(initialRecoveries);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    initialRecoveries[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [operator, setOperator] = useState<OperatorFilter>("all");
  const [coordinates, setCoordinates] = useState<CoordinateFilter>("all");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refreshFrame = window.requestAnimationFrame(() => {
      const refreshedRecoveries = getAdminLockerRecoveryDetails();
      const params = new URLSearchParams(window.location.search);
      const requestedIncidentId = params.get("incidentId");
      const requestedOrderId = params.get("orderId");
      const requestedByOrder =
        requestedOrderId !== null
          ? refreshedRecoveries.find(
              (incident) => incident.orderId === requestedOrderId,
            ) ?? null
          : null;

      setRecoveries(refreshedRecoveries);
      setSelectedIncidentId(
        (currentId) =>
          requestedIncidentId ??
          requestedByOrder?.id ??
          currentId ??
          refreshedRecoveries[0]?.id ??
          null,
      );
    });

    return () => window.cancelAnimationFrame(refreshFrame);
  }, []);

  const filteredRecoveries = useMemo(() => {
    const query = normalizeSearch(search);

    return recoveries.filter((incident) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeSearch(incident.orderId).includes(query) ||
        normalizeSearch(incident.lockerId).includes(query) ||
        normalizeSearch(incident.customer.name).includes(query) ||
        normalizeSearch(incident.customer.email ?? "").includes(query) ||
        normalizeSearch(incident.exactLocation ?? "").includes(query) ||
        normalizeSearch(incident.assignedOperatorName ?? "").includes(query);

      return (
        matchesSearch &&
        (status === "all" || incident.status === status) &&
        (operator === "all" ||
          (operator === "assigned"
            ? Boolean(incident.assignedOperatorName)
            : !incident.assignedOperatorName)) &&
        (coordinates === "all" || incident.dataCompleteness === coordinates)
      );
    });
  }, [coordinates, operator, recoveries, search, status]);

  const selectedRecovery =
    filteredRecoveries.find((incident) => incident.id === selectedIncidentId) ??
    filteredRecoveries[0] ??
    null;
  const activeCount = recoveries.filter((incident) => !incident.isResolved).length;
  const urgentWithCoordinatesCount = recoveries.filter(
    (incident) => !incident.isResolved && incident.coordinates,
  ).length;
  const noOperatorCount = recoveries.filter(
    (incident) => !incident.isResolved && !incident.assignedOperatorName,
  ).length;

  const filters: FilterBarItem[] = [
    {
      id: "status",
      label: "Status",
      value: status,
      onChange: (value) => setStatus(value as StatusFilter),
      options: [
        { label: "Toate statusurile", value: "all" },
        ...lockerRecoveryStatusOptions.map(([value, label]) => ({
          label,
          value,
        })),
      ],
    },
    {
      id: "operator",
      label: "Operator",
      value: operator,
      onChange: (value) => setOperator(value as OperatorFilter),
      options: [
        { label: "Toti operatorii", value: "all" },
        { label: "Cu operator", value: "assigned" },
        { label: "Neatribuite", value: "unassigned" },
      ],
    },
    {
      id: "coordinates",
      label: "Locație",
      value: coordinates,
      onChange: (value) => setCoordinates(value as CoordinateFilter),
      options: [
        { label: "Toate locatiile", value: "all" },
        { label: dataCompletenessLabels.exact, value: "exact" },
        { label: dataCompletenessLabels.partial, value: "partial" },
        {
          label: dataCompletenessLabels.missing_coordinates,
          value: "missing_coordinates",
        },
      ],
    },
  ];

  function refreshRecoveries(incidentId: string) {
    const refreshedRecoveries = getAdminLockerRecoveryDetails();

    setRecoveries(refreshedRecoveries);
    setSelectedIncidentId(incidentId);
  }

  function handleUpdate(
    incidentId: string,
    patch: AdminLockerRecoveryUpdatePatch,
    changeReason: string | null,
  ) {
    setIsSaving(true);

    const result = updateAdminLockerRecovery({
      incidentId,
      patch,
      actor: adminActor,
      reason: changeReason,
    });

    if (!result.ok) {
      setFeedback({
        tone: "error",
        message:
          result.reason === "storage_unavailable"
            ? "Modificările nu pot fi salvate fără stocare locală în browser."
            : "Incidentul de recuperare nu a fost găsit.",
      });
      setIsSaving(false);
      return;
    }

    refreshRecoveries(result.incident.id);
    setFeedback({
      tone: "success",
      message:
        result.auditEvents.length > 0
          ? `Modificările au fost salvate. Evenimente audit: ${result.auditEvents.length}.`
          : "Nu au existat modificări noi de salvat.",
    });
    setIsSaving(false);
  }

  if (recoveries.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        <AdminPageHeader
          eyebrow="Panou Administrator"
          title="Recuperare locker"
          description="Modul de excepție pentru cazurile rare în care coletul este prea greu, drona nu poate ridica lockerul, iar lockerul rămâne pe teren."
          actions={
            <>
              <AppButton asChild variant="outline">
                <Link href="/admin/failed-orders">
                  Incidente
                  <ArrowRight className="size-4" />
                </Link>
              </AppButton>
              <AppButton asChild>
                <Link href="/admin">
                  Privire generală
                  <MapPinned className="size-4" />
                </Link>
              </AppButton>
            </>
          }
        />

        <Card className="rounded-[calc(var(--radius)+0.5rem)] border-success/25">
          <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:items-center">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <p className="font-heading text-2xl tracking-tight text-foreground">
                  Nu există recuperări de locker
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Modulul rămâne gol până când simularea generează un caz valid:
                  colet peste limita, drona nu poate ridica lockerul, lockerul se
                  decuplează și rămâne pe teren pentru recuperare fizică.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
                <p className="text-xs text-muted-foreground">Incidente active</p>
                <p className="mt-1 font-heading text-3xl tracking-tight">0</p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
                <p className="text-xs text-muted-foreground">Lockere pe teren</p>
                <p className="mt-1 font-heading text-3xl tracking-tight">0</p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-4">
                <p className="text-xs text-muted-foreground">Operator necesar</p>
                <p className="mt-1 font-heading text-3xl tracking-tight">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[calc(var(--radius)+0.5rem)]">
          <CardContent className="grid gap-4 p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Când apare aici</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Doar incidentele generate din comenzile reale ale simulării sunt
                  listate. Nu se adaugă lockere, operatori sau locații pentru a
                  popula artificial pagina.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Recuperare locker"
        description="Incidente urgente în care lockerul rămâne pe teren și trebuie recuperat fizic de un operator SkySend."
        actions={
          <>
            <AppButton asChild variant="outline">
              <Link href="/admin/failed-orders">
                Incidente
                <ArrowRight className="size-4" />
              </Link>
            </AppButton>
            <AppButton asChild>
              <Link href="/admin">
                Privire generală
                <MapPinned className="size-4" />
              </Link>
            </AppButton>
          </>
        }
      />

      <LockerRecoveryAlertHeader recoveries={recoveries} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Incidente active</p>
            <p className="font-heading text-3xl tracking-tight">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Cu coordonate</p>
            <p className="font-heading text-3xl tracking-tight">
              {urgentWithCoordinatesCount}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Neatribuite</p>
            <p className="font-heading text-3xl tracking-tight">
              {noOperatorCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <LockerRecoveryMap
        recoveries={filteredRecoveries}
        selectedIncidentId={selectedRecovery?.id ?? null}
        onSelect={setSelectedIncidentId}
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Caută după locker, comandă, client, e-mail, locație sau operator"
        filters={filters}
      />

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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.03fr)_minmax(24rem,0.97fr)]">
        <LockerRecoveryTable
          recoveries={filteredRecoveries}
          selectedIncidentId={selectedRecovery?.id ?? null}
          onSelect={setSelectedIncidentId}
        />

        <LockerRecoveryDetailsPanel
          incident={selectedRecovery}
          onUpdate={handleUpdate}
          isSaving={isSaving}
        />
      </div>
    </section>
  );
}
