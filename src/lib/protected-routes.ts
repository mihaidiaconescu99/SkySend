import "server-only";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/clerk-config";
import {
  canAccessAdminPanel,
  canAccessRoleRoute,
  getInvalidRoleRedirectPath,
  getPostAuthRedirectPath,
} from "@/lib/auth";
import { getStaffAccessConfig } from "@/lib/staff-access/config";
import { verifyCloudflareAccessToken } from "@/lib/staff-access/cloudflare";
import { getCurrentStaffAccess } from "@/lib/staff-access/server";
import type { AccessKind } from "@/types/staff-access";
import type { UserRole } from "@/types/roles";

type UnauthorizedBehavior = "redirect_home" | "access_denied";

export type ProtectedRouteContext = {
  userId: string;
  profileId: string | null;
  role: UserRole | null;
  roleSource: "database" | null;
  isRoleMismatch: boolean;
  accessKind: AccessKind | null;
  expiresAt: string | null;
  isPermanentAdmin: boolean;
};

export type AdminRouteContext = ProtectedRouteContext & {
  canAccessAdmin: boolean;
};

function createAccessDeniedUrl(expectedRole: UserRole, currentRole?: UserRole | null) {
  const params = new URLSearchParams({ required: expectedRole });
  if (currentRole) params.set("current", currentRole);
  return `/access-denied?${params.toString()}`;
}

async function getAuthenticatedRoleContext(): Promise<ProtectedRouteContext> {
  if (!isClerkConfigured()) redirect("/sign-in?auth=not-configured");
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const access = await getCurrentStaffAccess();
  const strictMismatch = Boolean(
    access?.integrationMismatch && getStaffAccessConfig().enforcement === "strict",
  );
  return {
    userId,
    profileId: access?.profileId ?? null,
    role: strictMismatch ? null : access?.role ?? null,
    roleSource: access ? "database" : null,
    isRoleMismatch: strictMismatch,
    accessKind: access?.accessKind ?? null,
    expiresAt: access?.expiresAt ?? null,
    isPermanentAdmin: Boolean(access?.isPermanentAdmin && !strictMismatch),
  };
}

export async function requireAuthenticatedRoute() {
  return getAuthenticatedRoleContext();
}

export async function requireAdminRoute(): Promise<AdminRouteContext> {
  const context = await getAuthenticatedRoleContext();
  const cloudflare = await verifyCloudflareAccessToken(
    (await headers()).get("cf-access-jwt-assertion"),
  );
  return {
    ...context,
    canAccessAdmin: cloudflare.ok && canAccessAdminPanel(context.role),
  };
}

export async function requireRoleRoute(
  expectedRole: UserRole,
  behavior: UnauthorizedBehavior = "redirect_home",
) {
  const context = await getAuthenticatedRoleContext();
  if (context.role && canAccessRoleRoute(context.role, expectedRole)) return context;
  if (behavior === "redirect_home" && context.role) redirect(getPostAuthRedirectPath(context.role));
  if (!context.role) redirect(getInvalidRoleRedirectPath("no-role"));
  redirect(createAccessDeniedUrl(expectedRole, context.role));
}

export async function requireSupportOperatorRoute() {
  const context = await getAuthenticatedRoleContext();
  if (context.role === "admin" || context.role === "operator") return context;
  if (context.role) redirect(getPostAuthRedirectPath(context.role));
  redirect(getInvalidRoleRedirectPath("no-role"));
}
