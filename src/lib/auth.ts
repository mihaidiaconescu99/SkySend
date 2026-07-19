import {
  adminPanelRoles,
  roleBindingStrategy,
  roleHomePaths,
  roleRoutingPaths,
  userRoles,
} from "@/constants/roles";
import type {
  ClerkRoleMetadata,
  DashboardRole,
  RoleResolution,
  RoleResolutionInput,
  UserRole,
} from "@/types/roles";

const dashboardRoles: readonly DashboardRole[] = [
  "client",
  "admin",
  "operator",
];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function isDashboardRole(value: unknown): value is DashboardRole {
  return (
    typeof value === "string" &&
    dashboardRoles.includes(value as DashboardRole)
  );
}

export function getRoleFromClerkMetadata(
  publicMetadata: ClerkRoleMetadata | null | undefined,
  privateMetadata?: ClerkRoleMetadata | null | undefined,
) {
  if (isUserRole(privateMetadata?.role)) {
    return privateMetadata.role;
  }

  return isUserRole(publicMetadata?.role) ? publicMetadata.role : null;
}

export function isDevelopmentRoleFallbackEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function getDevelopmentRoleFallback() {
  return isDevelopmentRoleFallbackEnabled()
    ? roleBindingStrategy.developmentFallbackRole
    : null;
}

export function hasRole(currentRole: UserRole | null | undefined, role: UserRole) {
  return currentRole === role;
}

export function hasAnyRole(
  currentRole: UserRole | null | undefined,
  roles: readonly UserRole[],
) {
  return Boolean(currentRole && roles.includes(currentRole));
}

export function canAccessAdminPanel(role: UserRole | null | undefined) {
  return hasAnyRole(role, adminPanelRoles);
}

export function getRoleHomePath(role: UserRole) {
  return roleHomePaths[role];
}

export function getInvalidRoleRedirectPath(reason: "invalid-role" | "no-role" = "invalid-role") {
  return reason === "no-role" ? roleRoutingPaths.noRole : roleRoutingPaths.invalidRole;
}

export function getPostAuthRedirectPath(role: UserRole | null | undefined) {
  if (!role) {
    return getInvalidRoleRedirectPath("no-role");
  }

  return getRoleHomePath(role);
}

export function canAccessRoleRoute(
  currentRole: UserRole | null | undefined,
  targetRole: UserRole,
) {
  if (!currentRole) return false;
  if (currentRole === "admin") return true;
  if (currentRole === "operator") {
    return targetRole === "operator" || targetRole === "client";
  }
  return currentRole === "client" && targetRole === "client";
}

export function resolveUserRole({
  clerkRole,
  databaseRole,
  fallbackRole = roleBindingStrategy.fallbackRole,
}: RoleResolutionInput): RoleResolution {
  const effectiveFallbackRole =
    fallbackRole ?? getDevelopmentRoleFallback();

  if (databaseRole && clerkRole) {
    return {
      role: databaseRole,
      source: "database",
      isMismatch: databaseRole !== clerkRole,
      shouldSyncClerkMetadata: databaseRole !== clerkRole,
      shouldPersistToDatabase: false,
    };
  }

  if (databaseRole) {
    return {
      role: databaseRole,
      source: "database",
      isMismatch: false,
      shouldSyncClerkMetadata: true,
      shouldPersistToDatabase: false,
    };
  }

  if (clerkRole) {
    return {
      role: clerkRole,
      source: "clerk_metadata",
      isMismatch: false,
      shouldSyncClerkMetadata: false,
      shouldPersistToDatabase: true,
    };
  }

  return {
    role: effectiveFallbackRole,
    source: effectiveFallbackRole ? "fallback" : null,
    isMismatch: false,
    shouldSyncClerkMetadata: Boolean(effectiveFallbackRole),
    shouldPersistToDatabase: Boolean(effectiveFallbackRole),
  };
}

export function getRequiredRoleForPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isUserRole(firstSegment) ? firstSegment : null;
}
