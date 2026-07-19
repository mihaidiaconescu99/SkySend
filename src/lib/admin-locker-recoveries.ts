import {
  getLockerRecoveryIncidents,
  lockerRecoveryStatusLabels,
  updateAdminOrder,
} from "@/lib/admin-data";
import {
  appendAdminAuditEvents,
  createAdminAuditEvent,
} from "@/lib/admin-audit";
import type {
  AdminAuditActor,
  AdminOrder,
  AdminOrderAuditEvent,
  LockerRecoveryIncident,
  LockerRecoveryStatus,
} from "@/types/admin";
import type { Json } from "@/types/database";
import type {
  AdminLockerRecoveryDetail,
  AdminLockerRecoveryUpdatePatch,
  AdminLockerRecoveryUpdateResult,
  LockerRecoveryStatusHistoryEvent,
} from "@/types/admin-locker-recoveries";

const lockerRecoveryOverridesStorageKey =
  "skysend:admin:locker-recovery-overrides";

const lockerRecoveryStatusOrder: LockerRecoveryStatus[] = [
  "locker_detached",
  "operator_dispatched",
  "locker_recovered",
  "parcel_returned_to_hub",
  "customer_notified",
  "resolved",
];

type LockerRecoveryOverrideRecord = {
  incidentId: string;
  orderId: string;
  status?: LockerRecoveryStatus;
  assignedOperatorId?: string | null;
  assignedOperatorName?: string | null;
  internalNote?: string | null;
  clientNotified?: boolean;
  statusHistory?: LockerRecoveryStatusHistoryEvent[];
  updatedAt: string;
  updatedBy: string;
};

type LockerRecoveryOverrideRecords = Record<string, LockerRecoveryOverrideRecord>;

export const lockerRecoveryStatusOptions = Object.entries(
  lockerRecoveryStatusLabels,
) as [LockerRecoveryStatus, string][];

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createAdminRecordId(prefix: string) {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${entropy}`;
}

function toJsonValue(value: unknown): Json {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Json;
}

function readOverrideRecords(): LockerRecoveryOverrideRecords {
  if (!canUseLocalStorage()) {
    return {};
  }

  const rawValue = window.localStorage.getItem(lockerRecoveryOverridesStorageKey);

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? (parsedValue as LockerRecoveryOverrideRecords)
      : {};
  } catch {
    return {};
  }
}

function writeOverrideRecords(records: LockerRecoveryOverrideRecords) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    lockerRecoveryOverridesStorageKey,
    JSON.stringify(records),
  );
}

function formatGoogleMapsHref(incident: LockerRecoveryIncident) {
  if (!incident.coordinates) {
    return null;
  }

  const { latitude, longitude } = incident.coordinates;

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function getWeightOverLimit(incident: LockerRecoveryIncident) {
  if (incident.limitKg === null) {
    return null;
  }

  if (incident.detectedWeightKg !== null) {
    return incident.detectedWeightKg > incident.limitKg;
  }

  if (incident.estimatedWeightKg !== null) {
    return incident.estimatedWeightKg > incident.limitKg;
  }

  return null;
}

function getBaseStatusHistory(
  incident: LockerRecoveryIncident,
): LockerRecoveryStatusHistoryEvent {
  return {
    id: `locker_history_base_${incident.id}`,
    incidentId: incident.id,
    status: "locker_detached",
    statusLabel: lockerRecoveryStatusLabels.locker_detached,
    actorId: "system",
    actorName: "Sistem SkySend",
    note:
      "Drona a decuplat lockerul dupa detectia de greutate peste limita si a parasit zona.",
    createdAt: incident.detachedAt ?? incident.createdAt,
  };
}

function applyOverride(
  incident: LockerRecoveryIncident,
  override?: LockerRecoveryOverrideRecord,
): AdminLockerRecoveryDetail {
  const status = override?.status ?? incident.status;
  const assignedOperatorId =
    override?.assignedOperatorId ?? incident.assignedOperatorId ?? null;
  const assignedOperatorName =
    override?.assignedOperatorName ?? incident.assignedOperatorName ?? null;
  const clientNotified =
    override?.clientNotified ??
    (status === "customer_notified" || status === "resolved");
  const statusHistory = [
    getBaseStatusHistory(incident),
    ...(override?.statusHistory ?? []),
  ].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return {
    ...incident,
    status,
    statusLabel: lockerRecoveryStatusLabels[status],
    assignedOperatorId,
    assignedOperatorName,
    internalNote: override?.internalNote ?? null,
    clientNotified,
    updatedAt: override?.updatedAt ?? incident.updatedAt,
    location: {
      label: incident.exactLocation,
      coordinates: incident.coordinates,
      dataCompleteness: incident.dataCompleteness,
      meetingPointLabel: incident.meetingPoint?.label ?? null,
    },
    weightDetection: {
      estimatedWeightKg: incident.estimatedWeightKg,
      detectedWeightKg: incident.detectedWeightKg,
      limitKg: incident.limitKg,
      isOverLimit: getWeightOverLimit(incident),
    },
    assignedOperator: {
      id: assignedOperatorId,
      name: assignedOperatorName,
    },
    statusHistory,
    orderHref: `/admin/orders?orderId=${encodeURIComponent(incident.orderId)}`,
    failedOrderHref: `/admin/failed-orders?orderId=${encodeURIComponent(
      incident.orderId,
    )}`,
    googleMapsHref: formatGoogleMapsHref(incident),
    isResolved: status === "resolved",
  };
}

function getStatusIndex(status: LockerRecoveryStatus) {
  return lockerRecoveryStatusOrder.indexOf(status);
}

function normalizeStatusPatch(
  currentStatus: LockerRecoveryStatus,
  patch: AdminLockerRecoveryUpdatePatch,
) {
  if (patch.status) {
    return patch.status;
  }

  if (patch.clientNotified === true) {
    return getStatusIndex(currentStatus) < getStatusIndex("customer_notified")
      ? "customer_notified"
      : currentStatus;
  }

  return currentStatus;
}

function createLockerAuditEvents({
  incident,
  current,
  next,
  patch,
  actor,
  reason,
  createdAt,
}: {
  incident: LockerRecoveryIncident;
  current: AdminLockerRecoveryDetail;
  next: LockerRecoveryOverrideRecord;
  patch: AdminLockerRecoveryUpdatePatch;
  actor: AdminAuditActor;
  reason: string | null;
  createdAt: string;
}) {
  const events: AdminOrderAuditEvent[] = [];
  const comparisons: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[] = [];

  if (next.status && next.status !== current.status) {
    comparisons.push({
      field: "lockerRecoveryStatus",
      oldValue: current.status,
      newValue: next.status,
    });
  }

  if (
    "assignedOperatorName" in patch &&
    next.assignedOperatorName !== current.assignedOperatorName
  ) {
    comparisons.push({
      field: "lockerRecoveryOperator",
      oldValue: current.assignedOperatorName,
      newValue: next.assignedOperatorName,
    });
  }

  if ("internalNote" in patch && next.internalNote !== current.internalNote) {
    comparisons.push({
      field: "lockerRecoveryNote",
      oldValue: current.internalNote,
      newValue: next.internalNote,
    });
  }

  if ("clientNotified" in patch && next.clientNotified !== current.clientNotified) {
    comparisons.push({
      field: "lockerRecoveryClientNotified",
      oldValue: current.clientNotified,
      newValue: next.clientNotified,
    });
  }

  comparisons.forEach((comparison) => {
    events.push(
      createAdminAuditEvent({
        orderId: incident.orderId,
        actor,
        field: comparison.field,
        oldValue: toJsonValue(comparison.oldValue),
        newValue: toJsonValue(comparison.newValue),
        reason,
        createdAt,
      }),
    );
  });

  return events;
}

export function getAdminLockerRecoveryDetails(adminOrders?: AdminOrder[]): AdminLockerRecoveryDetail[] {
  const overrides = readOverrideRecords();

  return getLockerRecoveryIncidents(adminOrders)
    .map((incident) => applyOverride(incident, overrides[incident.id]))
    .sort((left, right) => {
      if (left.isResolved !== right.isResolved) {
        return left.isResolved ? 1 : -1;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}

export function getAdminLockerRecoveryDetail(identifier: string) {
  return (
    getAdminLockerRecoveryDetails().find(
      (incident) =>
        incident.id === identifier ||
        incident.orderId === identifier ||
        incident.lockerId === identifier,
    ) ?? null
  );
}

export function updateAdminLockerRecovery({
  incidentId,
  patch,
  actor,
  reason = null,
}: {
  incidentId: string;
  patch: AdminLockerRecoveryUpdatePatch;
  actor: AdminAuditActor;
  reason?: string | null;
}): AdminLockerRecoveryUpdateResult {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "storage_unavailable",
      incident: null,
      auditEvents: [],
    };
  }

  const baseIncident =
    getLockerRecoveryIncidents().find(
      (incident) => incident.id === incidentId || incident.orderId === incidentId,
    ) ?? null;

  if (!baseIncident) {
    return {
      ok: false,
      reason: "not_found",
      incident: null,
      auditEvents: [],
    };
  }

  const records = readOverrideRecords();
  const existingRecord = records[baseIncident.id];
  const current = applyOverride(baseIncident, existingRecord);
  const updatedAt = new Date().toISOString();
  const nextStatus = normalizeStatusPatch(current.status, patch);
  const nextAssignedOperatorId =
    "assignedOperatorId" in patch
      ? patch.assignedOperatorId ?? null
      : current.assignedOperatorId;
  const nextAssignedOperatorName =
    "assignedOperatorName" in patch
      ? patch.assignedOperatorName ?? null
      : current.assignedOperatorName;
  const nextInternalNote =
    "internalNote" in patch ? patch.internalNote ?? null : current.internalNote;
  const nextClientNotified =
    "clientNotified" in patch
      ? patch.clientNotified ?? false
      : current.clientNotified ||
        nextStatus === "customer_notified" ||
        nextStatus === "resolved";
  const statusHistory = [...(existingRecord?.statusHistory ?? [])];

  if (nextStatus !== current.status) {
    statusHistory.push({
      id: createAdminRecordId("locker_history"),
      incidentId: baseIncident.id,
      status: nextStatus,
      statusLabel: lockerRecoveryStatusLabels[nextStatus],
      actorId: actor.actorId,
      actorName: actor.actorName ?? null,
      note: reason,
      createdAt: updatedAt,
    });
  }

  const nextRecord: LockerRecoveryOverrideRecord = {
    incidentId: baseIncident.id,
    orderId: baseIncident.orderId,
    status: nextStatus,
    assignedOperatorId: nextAssignedOperatorId,
    assignedOperatorName: nextAssignedOperatorName,
    internalNote: nextInternalNote,
    clientNotified: nextClientNotified,
    statusHistory,
    updatedAt,
    updatedBy: actor.actorId,
  };
  const lockerAuditEvents = createLockerAuditEvents({
    incident: baseIncident,
    current,
    next: nextRecord,
    patch,
    actor,
    reason,
    createdAt: updatedAt,
  });

  writeOverrideRecords({
    ...records,
    [baseIncident.id]: nextRecord,
  });
  appendAdminAuditEvents(lockerAuditEvents);

  const orderPatch: Parameters<typeof updateAdminOrder>[0]["patch"] = {};

  if ("internalNote" in patch) {
    orderPatch.internalNotes = nextInternalNote;
  }

  if (nextStatus === "operator_dispatched") {
    orderPatch.resolutionStatus = "in_progress";
  }

  if (nextStatus === "customer_notified") {
    orderPatch.customerNotificationStatus = "sent";
  }

  if (nextStatus === "resolved") {
    orderPatch.resolutionStatus = "resolved";
    orderPatch.customerNotificationStatus = nextClientNotified ? "sent" : "prepared";
  }

  if ("clientNotified" in patch) {
    orderPatch.customerNotificationStatus = nextClientNotified ? "sent" : "prepared";
  }

  const orderResult =
    Object.keys(orderPatch).length > 0
      ? updateAdminOrder({
          orderId: baseIncident.orderId,
          patch: orderPatch,
          actor,
          reason,
        })
      : null;
  const refreshedIncident = getAdminLockerRecoveryDetail(baseIncident.id);

  return {
    ok: true,
    incident: refreshedIncident ?? applyOverride(baseIncident, nextRecord),
    auditEvents: [
      ...lockerAuditEvents,
      ...(orderResult?.ok ? orderResult.auditEvents : []),
    ],
    persistence: "local_only",
  };
}
