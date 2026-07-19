

export type ProfileRole = "client" | "admin" | "operator";

export interface NotificationPreferences {
  popup: boolean;
  email: boolean;
}

export interface Profile {
  id: string;
  clerkUserId: string;
  email: string;
  fullName: string | null;
  role: ProfileRole;
  notificationPreferences: NotificationPreferences;

  createdAt: string;

  updatedAt: string;
}

export interface CreateProfileInput {
  clerkUserId: string;
  email: string;
  fullName?: string | null;
  role?: ProfileRole;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export interface UpdateProfileInput {
  email?: string;
  fullName?: string | null;
  role?: ProfileRole;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  popup: true,
  email: true,
};

export const PROFILE_ROLES: readonly ProfileRole[] = [
  "client",
  "admin",
  "operator",
] as const;
