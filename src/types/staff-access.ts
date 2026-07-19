export type StaffRole = "client" | "operator" | "admin";

export type AccessKind = "permanent" | "temporary";

export type StaffAccessAssignmentStatus =
  | "pending_sync"
  | "active"
  | "revoked"
  | "expired"
  | "failed";

export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "revoked";

export type AccessCapability =
  | "view_client_workspace"
  | "view_operator_workspace"
  | "view_admin_workspace"
  | "request_admin_access"
  | "manage_staff_access";

export type StaffAccessContext = {
  clerkUserId: string;
  profileId: string;
  email: string;
  role: StaffRole;
  accessKind: AccessKind | null;
  assignmentId: string | null;
  expiresAt: string | null;
  isPermanentAdmin: boolean;
  capabilities: readonly AccessCapability[];
  integrationMismatch: boolean;
};

export type StaffUserLookup = {
  clerkUserId: string;
  profileId: string | null;
  email: string;
  fullName: string | null;
  imageUrl: string | null;
  emailVerified: boolean;
  role: StaffRole;
  accessKind: AccessKind | null;
  assignmentId: string | null;
  expiresAt: string | null;
  assignmentStatus: StaffAccessAssignmentStatus | null;
};

export type AdminAccessRequestRecord = {
  id: string;
  requesterProfileId: string;
  requesterName: string | null;
  requesterEmail: string;
  requestedDurationMinutes: 60 | 240 | 1440 | 10080;
  reason: string;
  status: AccessRequestStatus;
  reviewNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export const adminAccessDurations = [60, 240, 1440, 10080] as const;
export type AdminAccessDuration = (typeof adminAccessDurations)[number];
