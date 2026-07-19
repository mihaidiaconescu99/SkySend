

import {
  RepositoryError,
  type DBInsert,
  type DBRow,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import type { AuditEvent, CreateAuditEventInput } from "@/types/audit-event";

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

export function parseChanges(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function rowToAuditEvent(row: DBRow<"audit_events">): AuditEvent {
  const createdAt = requireString(row.created_at, "created_at");
  return {
    id: requireString(row.id, "id"),
    actorProfileId: row.actor_profile_id ?? null,
    actorRole: requireString(row.actor_role, "actor_role"),
    action: requireString(row.action, "action"),
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    changes: parseChanges(row.changes),
    occurredAt: row.occurred_at ? requireString(row.occurred_at, "occurred_at") : createdAt,
    createdAt,
  };
}

export function createInputToRow(
  input: CreateAuditEventInput,
): DBInsert<"audit_events"> {
  const row: DBInsert<"audit_events"> = {
    actor_role: requireString(input.actorRole, "actorRole"),
    action: requireString(input.action, "action"),
    changes: (input.changes ?? {}) as unknown as Json,
  };

  if (input.actorProfileId !== undefined) {
    row.actor_profile_id = input.actorProfileId;
  }
  if (input.entityType !== undefined) {
    row.entity_type = input.entityType;
  }
  if (input.entityId !== undefined) {
    row.entity_id = input.entityId;
  }
  if (input.occurredAt !== undefined) {
    row.occurred_at = requireString(input.occurredAt, "occurredAt");
  }

  return row;
}
