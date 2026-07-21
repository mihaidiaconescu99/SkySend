

import { MissionEventsRepository } from "@/lib/repositories/mission-events-repository";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MissionEvent as RuntimeMissionEvent } from "@/types/mission";
import type { Json } from "@/types/database";
import type {
  DroneTelemetrySnapshot,
  MissionRecord,
  MissionStatus,
} from "@/types/mission-record";

const TELEMETRY_WRITE_INTERVAL_MS = 5_000;

const dbMissionIdCache = new Map<string, string>();

const rehydratingOrderIds = new Set<string>();

const telemetryWriteTimestamps = new Map<string, number>();

function canPersist(): boolean {
  return typeof window !== "undefined";
}

function getMissionsRepo(): MissionsRepository {
  return new MissionsRepository(getBrowserSupabaseClient());
}

function getEventsRepo(): MissionEventsRepository {
  return new MissionEventsRepository(getBrowserSupabaseClient());
}

async function resolveDBMissionId(orderId: string): Promise<string | null> {
  const cached = dbMissionIdCache.get(orderId);
  if (cached) return cached;

  try {
    const result = await getMissionsRepo().getByOrderId(orderId);

    if (result.ok && result.data) {
      dbMissionIdCache.set(orderId, result.data.id);
      return result.data.id;
    }
  } catch (err) {
    console.warn("[mission-persistence] resolveDBMissionId failed:", err);
  }

  return null;
}

export function markOrderAsRehydrating(orderId: string): void {
  rehydratingOrderIds.add(orderId);
}

export function clearOrderAsRehydrating(orderId: string): void {
  rehydratingOrderIds.delete(orderId);
}

export async function persistMissionCreated(
  orderId: string,
  pickupPin: string | null,
  dropoffPin: string | null,
): Promise<void> {
  if (!canPersist()) return;
  if (rehydratingOrderIds.has(orderId)) return;

  try {
    const result = await getMissionsRepo().create({
      orderId,
      currentStatus: "mission_created",
      pickupPin,
      dropoffPin,
    });

    if (result.ok) {
      dbMissionIdCache.set(orderId, result.data.id);
    } else {
      console.warn(
        "[mission-persistence] persistMissionCreated failed:",
        result.error,
      );
    }
  } catch (err) {
    console.warn("[mission-persistence] persistMissionCreated threw:", err);
  }
}

export async function persistStatusChange(
  orderId: string,
  status: MissionStatus,
  state?: {
    stepStartedAt?: string | null;
    stepExpiresAt?: string | null;
    failureCode?: string | null;
    failedAt?: string | null;
    runtimeState?: Json;
  },
): Promise<void> {
  if (!canPersist()) return;

  const dbId = await resolveDBMissionId(orderId);
  if (!dbId) return;

  const now = new Date().toISOString();

  const isDispatch = status === "drone_dispatched";

  const isTerminal =
    status === "mission_closed" ||
    status === "mission_failed" ||
    status === "returned_to_hub";

  try {
    const result = await getMissionsRepo().updateById(dbId, {
      currentStatus: status,
      ...(isDispatch ? { startedAt: now } : {}),
      ...(isTerminal ? { completedAt: now } : {}),
      stepStartedAt: state?.stepStartedAt ?? now,
      stepExpiresAt: state?.stepExpiresAt ?? null,
      ...(state?.failureCode !== undefined
        ? { failureCode: state.failureCode }
        : {}),
      ...(state?.failedAt !== undefined ? { failedAt: state.failedAt } : {}),
      ...(state?.runtimeState !== undefined
        ? { runtimeState: state.runtimeState }
        : {}),
    });

    if (!result.ok) {
      console.warn(
        "[mission-persistence] persistStatusChange failed:",
        result.error,
      );
    }
  } catch (err) {
    console.warn("[mission-persistence] persistStatusChange threw:", err);
  }
}

export function maybeWriteTelemetryFromRuntime(
  orderId: string,
  telemetry: DroneTelemetrySnapshot,
  force = false,
): void {
  if (!canPersist()) return;

  const now = Date.now();
  const lastWrite = telemetryWriteTimestamps.get(orderId) ?? 0;

  if (!force && now - lastWrite < TELEMETRY_WRITE_INTERVAL_MS) {
    return;
  }

  telemetryWriteTimestamps.set(orderId, now);

  void (async () => {
    const dbId = await resolveDBMissionId(orderId);
    if (!dbId) return;

    try {
      const result = await getMissionsRepo().updateTelemetry(dbId, telemetry);

      if (!result.ok) {
        console.warn(
          "[mission-persistence] maybeWriteTelemetryFromRuntime failed:",
          result.error,
        );
      }
    } catch (err) {
      console.warn(
        "[mission-persistence] maybeWriteTelemetryFromRuntime threw:",
        err,
      );
    }
  })();
}

export async function persistMissionEvent(
  orderId: string,
  runtimeEvent: RuntimeMissionEvent,
): Promise<void> {
  if (!canPersist()) return;

  const dbId = await resolveDBMissionId(orderId);
  if (!dbId) return;

  const eventType =
    runtimeEvent.actor === "system" ? "system_event" : "user_action";

  try {
    const result = await getEventsRepo().create({
      missionId: dbId,
      eventType,
      title: runtimeEvent.title,
      description: runtimeEvent.description || null,
      metadata: {
        status: runtimeEvent.status,
        actor: runtimeEvent.actor,
        runtimeEventId: runtimeEvent.id,
      },
      occurredAt: runtimeEvent.timestamp,
    });

    if (!result.ok) {
      console.warn(
        "[mission-persistence] persistMissionEvent failed:",
        result.error,
      );
    }
  } catch (err) {
    console.warn("[mission-persistence] persistMissionEvent threw:", err);
  }
}

export async function persistPinAttempt(
  orderId: string,
  kind: "pickup" | "dropoff",
  success: boolean,
): Promise<void> {
  if (!canPersist()) return;

  const dbId = await resolveDBMissionId(orderId);
  if (!dbId) return;

  try {
    const result = await getMissionsRepo().recordPinAttempt(dbId, kind, success);

    if (!result.ok) {
      console.warn(
        "[mission-persistence] persistPinAttempt failed:",
        result.error,
      );
    }
  } catch (err) {
    console.warn("[mission-persistence] persistPinAttempt threw:", err);
  }
}

export async function getMissionFromDB(
  orderId: string,
): Promise<MissionRecord | null> {
  if (!canPersist()) return null;

  try {
    const result = await getMissionsRepo().getByOrderId(orderId);

    if (!result.ok) {
      console.warn(
        "[mission-persistence] getMissionFromDB failed:",
        result.error,
      );
      return null;
    }

    if (result.data) {
      dbMissionIdCache.set(orderId, result.data.id);
    }

    return result.data;
  } catch (err) {
    console.warn("[mission-persistence] getMissionFromDB threw:", err);
    return null;
  }
}
