import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import {
  CONTACT_MESSAGE_CATEGORIES,
  CONTACT_MESSAGE_STATUSES,
  type ContactMessage,
  type ContactMessageCategory,
  type ContactMessageStatus,
  type CreateContactMessageInput,
  type UpdateContactMessageInput,
} from "@/types/contact-message";

const EMAIL_RE = /^.+@.+\..+$/;

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

export function validateEmail(value: unknown): string {
  const email = requireString(value, "senderEmail").trim();
  if (!EMAIL_RE.test(email)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid email: "${email}".`,
      { details: { value } },
    );
  }
  return email;
}

export function parseContactMessageStatus(
  value: unknown,
): ContactMessageStatus {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid contact_message status: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(CONTACT_MESSAGE_STATUSES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid contact_message status: "${value}".`,
      { details: { value, allowed: CONTACT_MESSAGE_STATUSES } },
    );
  }
  return value as ContactMessageStatus;
}

export function parseContactMessageCategory(
  value: unknown,
): ContactMessageCategory | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid contact_message category: expected string or null, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(CONTACT_MESSAGE_CATEGORIES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid contact_message category: "${value}".`,
      { details: { value, allowed: CONTACT_MESSAGE_CATEGORIES } },
    );
  }
  return value as ContactMessageCategory;
}

export function rowToContactMessage(
  row: DBRow<"contact_messages">,
): ContactMessage {
  return {
    id: requireString(row.id, "id"),
    senderEmail: requireString(row.sender_email, "sender_email"),
    senderName: row.sender_name ?? null,
    subject: requireString(row.subject, "subject"),
    body: requireString(row.body, "body"),
    category: parseContactMessageCategory(row.category),
    status: parseContactMessageStatus(row.status),
    readAt: row.read_at ?? null,
    internalNote: row.internal_note ?? null,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function createInputToRow(
  input: CreateContactMessageInput,
): DBInsert<"contact_messages"> {
  const senderEmail = validateEmail(input.senderEmail);
  const subject = requireString(input.subject, "subject");
  const body = requireString(input.body, "body");

  const category =
    input.category === undefined
      ? null
      : parseContactMessageCategory(input.category);

  const row: DBInsert<"contact_messages"> = {
    sender_email: senderEmail,
    subject,
    body,
  };
  if (input.senderName !== undefined) {
    row.sender_name = input.senderName;
  }
  if (category !== null) {
    row.category = category;
  }
  return row;
}

export function updateInputToRow(
  input: UpdateContactMessageInput,
): DBUpdate<"contact_messages"> {
  const payload: DBUpdate<"contact_messages"> = {};

  if (input.status !== undefined) {
    payload.status = parseContactMessageStatus(input.status);
  }
  if (input.internalNote !== undefined) {
    payload.internal_note = input.internalNote;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
