import type {
  AdminDataSource,
  AdminPersistenceState,
  ContactMessage,
  ContactMessageStatus as BaseContactMessageStatus,
} from "@/types/admin";

export type ContactMessageStatus = BaseContactMessageStatus;
export type InboxContactMessageStatus = Extract<
  ContactMessageStatus,
  "new" | "read" | "archived"
>;

export type ContactMessageCategory =
  | "support"
  | "order"
  | "billing"
  | "technical"
  | "commercial"
  | "other";

export type ContactMessageInternalNote = {
  messageId: string;
  body: string;
  updatedAt: string;
};

export type ContactMessageSubmitInput = {
  email: string;
  subject: string;
  category: ContactMessageCategory;
  message: string;
};

export type AdminContactMessageDetail = Omit<
  ContactMessage,
  "status" | "statusLabel"
> & {
  status: InboxContactMessageStatus;
  statusLabel: string;
  categoryKey: ContactMessageCategory | "unknown";
  categoryLabel: string;
  sourceLabel: string;
  persistenceLabel: string;
  isArchived: boolean;
};

export type AdminContactMessageUpdatePatch = Partial<{
  status: ContactMessageStatus;
  internalNote: string | null;
}>;

export type ContactMessageSubmitResult =
  | {
      ok: true;
      message: ContactMessage;
      persistence: AdminPersistenceState;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "missing_subject"
        | "missing_category"
        | "missing_message"
        | "storage_unavailable";
      message: null;
      persistence: AdminPersistenceState;
    };

export type AdminContactMessageUpdateResult =
  | {
      ok: true;
      message: AdminContactMessageDetail;
      persistence: AdminPersistenceState;
    }
  | {
      ok: false;
      reason: "not_found" | "storage_unavailable";
      message: null;
      persistence: AdminPersistenceState;
    };

export type ContactMessageSourceInfo = {
  source: AdminDataSource;
  persistence: AdminPersistenceState;
};
