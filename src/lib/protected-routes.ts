import "server-only";

import { redirect } from "next/navigation";
import {
  canAccessRoleRoute,
  getInvalidRoleRedirectPath,
  getPostAuthRedirectPath,
} from "@/lib/auth";
import {
  getServerAuthorizationContext,
  type ServerAuthorizationContext,
} from "@/lib/server-authorization";
import type { UserRole } from "@/types/roles";

type UnauthorizedBehavior = "redirect_home" | "access_denied";

function createAccessDeniedUrl(
  expectedRole: UserRole,
  currentRole?: UserRole | null,
) {
  const params = new URLSearchParams({ required: expectedRole });
  if (currentRole) params.set("current", currentRole);
  return `/access-denied?${params.toString()}`;
}

function redirectForResolution(context: ServerAuthorizationContext): never {
  if (!context.userId) redirect("/sign-in");
  if (context.resolution === "not_configured") {
    redirect("/access-denied?reason=authorization-not-configured");
  }
  if (context.resolution === "unavailable") {
    redirect("/access-denied?reason=authorization-unavailable");
  }
  redirect(getInvalidRoleRedirectPath("invalid-role"));
}

export async function requireAuthenticatedRoute() {
  const context = await getServerAuthorizationContext();
  if (!context.userId || context.resolution !== "resolved" || !context.role) {
    redirectForResolution(context);
  }
  return context;
}

export async function requireRoleRoute(
  expectedRole: UserRole,
  behavior: UnauthorizedBehavior = "redirect_home",
) {
  const context = await getServerAuthorizationContext();
  if (!context.userId || context.resolution !== "resolved" || !context.role) {
    redirectForResolution(context);
  }
  if (context.needsOrganizationActivation) redirect("/auth/continue");
  if (canAccessRoleRoute(context.role, expectedRole)) return context;
  if (behavior === "redirect_home") {
    redirect(getPostAuthRedirectPath(context.role));
  }
  redirect(createAccessDeniedUrl(expectedRole, context.role));
}

export function requireAdminRoute() {
  return requireRoleRoute("admin", "access_denied");
}

export async function requireSupportOperatorRoute() {
  const context = await getServerAuthorizationContext();
  if (!context.userId || context.resolution !== "resolved" || !context.role) {
    redirectForResolution(context);
  }
  if (context.needsOrganizationActivation) redirect("/auth/continue");
  if (context.role === "admin" || context.role === "operator") return context;
  redirect(createAccessDeniedUrl("operator", context.role));
}
