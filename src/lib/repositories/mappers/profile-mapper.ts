import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  PROFILE_ROLES,
  type CreateProfileInput,
  type NotificationPreferences,
  type Profile,
  type ProfileRole,
  type UpdateProfileInput,
} from "@/types/profile";

export function parseNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const record = value as Record<string, unknown>;
  const popup =
    typeof record.popup === "boolean"
      ? record.popup
      : DEFAULT_NOTIFICATION_PREFERENCES.popup;
  const email =
    typeof record.email === "boolean"
      ? record.email
      : DEFAULT_NOTIFICATION_PREFERENCES.email;
  return { popup, email };
}

export function parseProfileRole(value: unknown): ProfileRole {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid profile role: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(PROFILE_ROLES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid profile role: "${value}".`,
      { details: { value, allowed: PROFILE_ROLES } },
    );
  }
  return value as ProfileRole;
}

function requireString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

export function rowToProfile(row: DBRow<"profiles">): Profile {
  return {
    id: requireString(row.id, "id"),
    clerkUserId: requireString(row.clerk_user_id, "clerk_user_id"),
    email: requireString(row.email, "email"),
    fullName: row.full_name ?? null,
    role: parseProfileRole(row.role),
    notificationPreferences: parseNotificationPreferences(
      row.notification_preferences,
    ),
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function createInputToRow(
  input: CreateProfileInput,
): DBInsert<"profiles"> {
  const clerkUserId = requireString(input.clerkUserId, "clerkUserId");
  const email = requireString(input.email, "email");

  const preferences: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(input.notificationPreferences ?? {}),
  };

  return {
    clerk_user_id: clerkUserId,
    email,

    full_name: input.fullName === undefined ? null : input.fullName,
    role: input.role ?? "client",

    notification_preferences: preferences as unknown as Json,
  };
}

export function updateInputToRow(
  input: UpdateProfileInput,
): DBUpdate<"profiles"> {
  const payload: DBUpdate<"profiles"> = {};

  if (input.email !== undefined) {
    payload.email = requireString(input.email, "email");
  }
  if (input.fullName !== undefined) {
    payload.full_name = input.fullName;
  }
  if (input.role !== undefined) {
    payload.role = input.role;
  }
  if (input.notificationPreferences !== undefined) {
    const merged: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...input.notificationPreferences,
    };

    payload.notification_preferences = merged as unknown as Json;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
