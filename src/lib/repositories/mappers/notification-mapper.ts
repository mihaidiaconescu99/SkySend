import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import {
  NOTIFICATION_TYPES,
  type CreateNotificationInput,
  type Notification,
  type NotificationType,
  type UpdateNotificationInput,
} from "@/types/notification";

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

export function parseNotificationMetadata(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export function parseNotificationType(value: unknown): NotificationType {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid notification type: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid notification type: "${value}".`,
      { details: { value, allowed: NOTIFICATION_TYPES } },
    );
  }
  return value as NotificationType;
}

export function rowToNotification(
  row: DBRow<"notifications">,
): Notification {
  return {
    id: requireString(row.id, "id"),
    profileId: row.profile_id ?? null,
    type: parseNotificationType(row.type),
    title: requireString(row.title, "title"),
    message: requireString(row.message, "message"),
    metadata: parseNotificationMetadata(row.metadata),
    actionUrl: row.action_url ?? null,
    read: row.read === true,
    readAt: row.read_at ?? null,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function createInputToRow(
  input: CreateNotificationInput,
): DBInsert<"notifications"> {
  const type = parseNotificationType(input.type);
  const title = requireString(input.title, "title");
  const message = requireString(input.message, "message");

  const row: DBInsert<"notifications"> = {
    type,
    title,
    message,
    metadata: (input.metadata ?? {}) as unknown as Json,
    read: false,
    read_at: null,
  };

  if (input.profileId !== undefined) {
    row.profile_id = input.profileId;
  }
  if (input.actionUrl !== undefined) {
    row.action_url = input.actionUrl;
  }
  return row;
}

export function updateInputToRow(
  input: UpdateNotificationInput,
): DBUpdate<"notifications"> {
  const payload: DBUpdate<"notifications"> = {};

  if (input.read !== undefined) {
    payload.read = input.read;
  }
  if (input.readAt !== undefined) {
    payload.read_at = input.readAt;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
