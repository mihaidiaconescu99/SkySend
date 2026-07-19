import type {
  AdminAuditActor,
  AdminEditableField,
  AdminOrderAuditEvent,
} from "@/types/admin";
import type { Json } from "@/types/database";

const adminAuditStorageKey = "skysend:admin:audit-events";

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

function readStoredAuditEvents(): AdminOrderAuditEvent[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(adminAuditStorageKey);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue)
      ? (parsedValue as AdminOrderAuditEvent[]).filter(
          (event) => typeof event?.id === "string" && typeof event.orderId === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeStoredAuditEvents(events: AdminOrderAuditEvent[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(adminAuditStorageKey, JSON.stringify(events));
}

export function createAdminAuditEvent({
  orderId,
  actor,
  field,
  oldValue,
  newValue,
  reason = null,
  createdAt = new Date().toISOString(),
}: {
  orderId: string;
  actor: AdminAuditActor;
  field: AdminEditableField | string;
  oldValue: Json;
  newValue: Json;
  reason?: string | null;
  createdAt?: string;
}): AdminOrderAuditEvent {
  return {
    id: createAdminRecordId("audit"),
    orderId,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    actorName: actor.actorName ?? null,
    field,
    oldValue,
    newValue,
    reason,
    createdAt,
  };
}

export function readAdminAuditEvents() {
  return readStoredAuditEvents().sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function readAdminOrderAuditEvents(orderId: string) {
  return readAdminAuditEvents().filter((event) => event.orderId === orderId);
}

export function appendAdminAuditEvent(event: AdminOrderAuditEvent) {
  if (!canUseLocalStorage()) {
    return event;
  }

  const events = readStoredAuditEvents();
  writeStoredAuditEvents([event, ...events]);

  return event;
}

export function appendAdminAuditEvents(eventsToAppend: AdminOrderAuditEvent[]) {
  if (!canUseLocalStorage() || eventsToAppend.length === 0) {
    return eventsToAppend;
  }

  const events = readStoredAuditEvents();
  writeStoredAuditEvents([...eventsToAppend, ...events]);

  return eventsToAppend;
}

export function clearAdminAuditEvents() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(adminAuditStorageKey);
}

export function recordAdminOrderAuditEvent(params: {
  orderId: string;
  actor: AdminAuditActor;
  field: AdminEditableField | string;
  oldValue: Json;
  newValue: Json;
  reason?: string | null;
}) {
  return appendAdminAuditEvent(createAdminAuditEvent(params));
}
