import {
  contactMessageStatusLabels,
  createContactMessage,
  readContactMessages,
  updateContactMessage,
} from "@/lib/admin-data";
import type { ContactMessage } from "@/types/admin";
import type {
  AdminContactMessageDetail,
  AdminContactMessageUpdatePatch,
  AdminContactMessageUpdateResult,
  ContactMessageCategory,
  InboxContactMessageStatus,
  ContactMessageSubmitInput,
  ContactMessageSubmitResult,
} from "@/types/admin-contact";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const contactMessageCategoryLabels: Record<ContactMessageCategory, string> = {
  support: "Suport",
  order: "Comandă existentă",
  billing: "Plăți și rambursări",
  technical: "Problemă tehnică",
  commercial: "Comercial",
  other: "Altă categorie",
};

export const contactMessageCategoryOptions = Object.entries(
  contactMessageCategoryLabels,
) as [ContactMessageCategory, string][];

export const inboxContactMessageStatusOptions = [
  ["new", contactMessageStatusLabels.new],
  ["read", contactMessageStatusLabels.read],
  ["archived", contactMessageStatusLabels.archived],
] as [InboxContactMessageStatus, string][];

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLongText(value: string) {
  return value.trim();
}

function getCategoryKey(value: string): ContactMessageCategory | "unknown" {
  return value in contactMessageCategoryLabels
    ? (value as ContactMessageCategory)
    : "unknown";
}

function getCategoryLabel(value: string) {
  const categoryKey = getCategoryKey(value);

  return categoryKey === "unknown"
    ? value || "Categorie necunoscută"
    : contactMessageCategoryLabels[categoryKey];
}

function getSourceLabel(message: ContactMessage) {
  switch (message.source) {
    case "runtime_local":
      return "Formular contact local";
    case "supabase":
      return "Supabase";
    case "admin_override":
      return "Administrare";
    case "mock":
      return "E-mail demo";
    case "default_config":
      return "Configurație implicită";
  }
}

function getPersistenceLabel(message: ContactMessage) {
  switch (message.persistence) {
    case "local_only":
      return "Salvat local";
    case "persisted":
      return "Persistat";
    case "not_persisted":
      return "Nesalvat";
  }
}

function mapContactMessage(message: ContactMessage): AdminContactMessageDetail {
  const categoryKey = getCategoryKey(message.category);
  const inboxStatus =
    message.status === "new" || message.status === "archived"
      ? message.status
      : "read";

  return {
    ...message,
    status: inboxStatus,
    statusLabel: contactMessageStatusLabels[inboxStatus],
    categoryKey,
    categoryLabel: getCategoryLabel(message.category),
    sourceLabel: getSourceLabel(message),
    persistenceLabel: getPersistenceLabel(message),
    isArchived: inboxStatus === "archived",
  };
}

function isValidCategory(value: string): value is ContactMessageCategory {
  return value in contactMessageCategoryLabels;
}

export function submitContactMessage(
  input: ContactMessageSubmitInput,
): ContactMessageSubmitResult {
  const email = normalizeText(input.email).toLowerCase();
  const subject = normalizeText(input.subject);
  const category = input.category;
  const message = normalizeLongText(input.message);

  if (!emailPattern.test(email)) {
    return {
      ok: false,
      reason: "invalid_email",
      message: null,
      persistence: "not_persisted",
    };
  }

  if (!subject) {
    return {
      ok: false,
      reason: "missing_subject",
      message: null,
      persistence: "not_persisted",
    };
  }

  if (!isValidCategory(category)) {
    return {
      ok: false,
      reason: "missing_category",
      message: null,
      persistence: "not_persisted",
    };
  }

  if (!message) {
    return {
      ok: false,
      reason: "missing_message",
      message: null,
      persistence: "not_persisted",
    };
  }

  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "storage_unavailable",
      message: null,
      persistence: "not_persisted",
    };
  }

  try {
    const createdMessage = createContactMessage({
      email,
      subject,
      category,
      message,
    });

    if (createdMessage.persistence === "not_persisted") {
      return {
        ok: false,
        reason: "storage_unavailable",
        message: null,
        persistence: createdMessage.persistence,
      };
    }

    return {
      ok: true,
      message: createdMessage,
      persistence: createdMessage.persistence,
    };
  } catch {
    return {
      ok: false,
      reason: "storage_unavailable",
      message: null,
      persistence: "not_persisted",
    };
  }
}

export function getAdminContactMessageDetails(
  adminMessages?: import("@/types/admin").ContactMessage[],
): AdminContactMessageDetail[] {
  return (adminMessages ?? readContactMessages()).map(mapContactMessage);
}

export function getAdminContactMessageDetail(messageId: string) {
  return (
    getAdminContactMessageDetails().find((message) => message.id === messageId) ??
    null
  );
}

export function updateAdminContactMessage({
  messageId,
  patch,
}: {
  messageId: string;
  patch: AdminContactMessageUpdatePatch;
}): AdminContactMessageUpdateResult {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "storage_unavailable",
      message: null,
      persistence: "not_persisted",
    };
  }

  const currentMessage = getAdminContactMessageDetail(messageId);

  if (!currentMessage) {
    return {
      ok: false,
      reason: "not_found",
      message: null,
      persistence: "local_only",
    };
  }

  try {
    const updatedMessage = updateContactMessage(messageId, patch);

    if (!updatedMessage) {
      return {
        ok: false,
        reason: "not_found",
        message: null,
        persistence: "local_only",
      };
    }

    return {
      ok: true,
      message: mapContactMessage(updatedMessage),
      persistence: updatedMessage.persistence,
    };
  } catch {
    return {
      ok: false,
      reason: "storage_unavailable",
      message: null,
      persistence: "not_persisted",
    };
  }
}
