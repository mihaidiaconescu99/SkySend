import {
  adminPanelRoles,
  roleHomePaths,
  roleRoutingPaths,
  userRoles,
} from "@/constants/roles";
import type {
  DashboardRole,
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
  if (currentRole === "admin") {
    return targetRole === "admin" || targetRole === "operator";
  }
  return currentRole === targetRole;
}

export function getRequiredRoleForPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isUserRole(firstSegment) ? firstSegment : null;
}
