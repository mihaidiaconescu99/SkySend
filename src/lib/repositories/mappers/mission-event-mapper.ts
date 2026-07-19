import {
  RepositoryError,
  type DBInsert,
  type DBRow,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import type {
  CreateMissionEventInput,
  MissionEvent,
} from "@/types/mission-event";

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

export function parseMissionEventMetadata(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function rowToMissionEvent(
  row: DBRow<"mission_events">,
): MissionEvent {
  return {
    id: requireString(row.id, "id"),
    missionId: requireString(row.mission_id, "mission_id"),
    eventType: requireString(row.event_type, "event_type"),
    title: requireString(row.title, "title"),
    description: row.description ?? null,
    metadata: parseMissionEventMetadata(row.metadata),
    occurredAt: requireString(row.occurred_at, "occurred_at"),
    createdAt: requireString(row.created_at, "created_at"),
  };
}

export function createInputToRow(
  input: CreateMissionEventInput,
): DBInsert<"mission_events"> {
  const row: DBInsert<"mission_events"> = {
    mission_id: requireString(input.missionId, "missionId"),
    event_type: requireString(input.eventType, "eventType"),
    title: requireString(input.title, "title"),
    metadata: (input.metadata ?? {}) as unknown as Json,
  };

  if (input.description !== undefined) {
    row.description = input.description;
  }
  if (input.occurredAt !== undefined) {
    row.occurred_at = requireString(input.occurredAt, "occurredAt");
  }

  return row;
}
