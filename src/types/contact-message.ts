

export type ContactMessageStatus = "new" | "read" | "replied" | "archived";
export const CONTACT_MESSAGE_STATUSES: readonly ContactMessageStatus[] = [
  "new",
  "read",
  "replied",
  "archived",
] as const;

export type ContactMessageCategory =
  | "support"
  | "order"
  | "billing"
  | "technical"
  | "commercial"
  | "other"
  | "suport"
  | "feedback"
  | "sales"
  | "altul";
export const CONTACT_MESSAGE_CATEGORIES: readonly ContactMessageCategory[] = [
  "support",
  "order",
  "billing",
  "technical",
  "commercial",
  "other",
  "suport",
  "feedback",
  "sales",
  "altul",
] as const;

export interface ContactMessage {
  id: string;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  body: string;
  category: ContactMessageCategory | null;
  status: ContactMessageStatus;
  readAt: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactMessageInput {
  senderEmail: string;
  senderName?: string | null;
  subject: string;
  body: string;
  category?: ContactMessageCategory | null;
}

export interface UpdateContactMessageInput {
  status?: ContactMessageStatus;
  internalNote?: string | null;
}
