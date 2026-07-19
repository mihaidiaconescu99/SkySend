export type UserRole = "client" | "admin" | "operator";

export type DashboardRole = UserRole;
export type RoleSource = "database" | "clerk_metadata" | "fallback";
export type RoleHomePath = `/${DashboardRole}`;

export type RoleMetric = {
  label: string;
  value: string;
  hint: string;
};

export type RoleConfig = {
  role: DashboardRole;
  label: string;
  title: string;
  description: string;
  basePath: RoleHomePath;
  accent: string;
  metrics: RoleMetric[];
  priorities: string[];
};

export type ClerkRoleMetadata = {
  role?: UserRole;
};

export type DatabaseUserRoleRecord = {
  clerkUserId: string;
  role: UserRole;
  isActivee: boolean;
  updatedAt: string;
  syncedClerkRole?: UserRole | null;
};

export type RoleResolutionInput = {
  clerkRole?: UserRole | null;
  databaseRole?: UserRole | null;
  fallbackRole?: UserRole | null;
};

export type RoleResolution = {
  role: UserRole | null;
  source: RoleSource | null;
  isMismatch: boolean;
  shouldSyncClerkMetadata: boolean;
  shouldPersistToDatabase: boolean;
};

export type RoleBindingStrategy = {
  sourceOfTruth: "database";
  clerkMetadataField: "publicMetadata.role";
  fallbackRole: UserRole;
  developmentFallbackRole: UserRole | null;
  notes: string[];
};
