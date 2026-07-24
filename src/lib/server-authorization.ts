import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import type { UserRole } from "@/types/roles";

export type ClerkInternalRole = "org:admin" | "org:member";
export type AuthorizationResolution =
  | "resolved"
  | "invalid_membership_role"
  | "not_configured"
  | "unavailable";

export type ServerAuthorizationContext = {
  userId: string | null;
  sessionId: string | null;
  role: UserRole | null;
  internalOrganizationId: string | null;
  internalMembershipRole: string | null;
  activeOrganizationId: string | null;
  activeOrganizationRole: string | null;
  needsOrganizationActivation: boolean;
  resolution: AuthorizationResolution;
};

export type AuthorizedServerAuthorizationContext =
  ServerAuthorizationContext & {
    userId: string;
    role: UserRole;
    resolution: "resolved";
  };

export type AuthorizationDecision =
  | { ok: true; context: AuthorizedServerAuthorizationContext }
  | { ok: false; status: 401 | 403 | 503; error: string };

export function getInternalOrganizationId() {
  return process.env.CLERK_INTERNAL_ORGANIZATION_ID?.trim() || null;
}

export function roleFromInternalMembership(
  membershipRole: string | null | undefined,
  hasMembership: boolean,
): UserRole | null {
  if (!hasMembership) return "client";
  if (membershipRole === "org:admin") return "admin";
  if (membershipRole === "org:member") return "operator";
  return null;
}

async function readInternalMembershipRole(
  organizationId: string,
  userId: string,
) {
  const client = await clerkClient();
  const response =
    await client.organizations.getOrganizationMembershipList({
      organizationId,
      userId: [userId],
      limit: 1,
    });
  const membership = response.data.find(
    (item) =>
      item.organization.id === organizationId &&
      (!item.publicUserData || item.publicUserData.userId === userId),
  );

  return membership?.role ?? null;
}

export async function getServerAuthorizationContext(): Promise<ServerAuthorizationContext> {
  const internalOrganizationId = getInternalOrganizationId();
  let authState: Awaited<ReturnType<typeof auth>>;
  try {
    authState = await auth();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[authorization] Clerk session lookup failed", error);
    return {
      userId: null,
      sessionId: null,
      role: null,
      internalOrganizationId,
      internalMembershipRole: null,
      activeOrganizationId: null,
      activeOrganizationRole: null,
      needsOrganizationActivation: false,
      resolution: "unavailable",
    };
  }
  const userId = authState.userId ?? null;
  const sessionId = authState.sessionId ?? null;
  const activeOrganizationId = authState.orgId ?? null;
  const activeOrganizationRole = authState.orgRole ?? null;

  if (!userId) {
    return {
      userId: null,
      sessionId,
      role: null,
      internalOrganizationId,
      internalMembershipRole: null,
      activeOrganizationId,
      activeOrganizationRole,
      needsOrganizationActivation: false,
      resolution: "resolved",
    };
  }

  if (!internalOrganizationId) {
    return {
      userId,
      sessionId,
      role: null,
      internalOrganizationId: null,
      internalMembershipRole: null,
      activeOrganizationId,
      activeOrganizationRole,
      needsOrganizationActivation: false,
      resolution: "not_configured",
    };
  }

  let internalMembershipRole: string | null;
  try {
    internalMembershipRole =
      activeOrganizationId === internalOrganizationId &&
      activeOrganizationRole
        ? activeOrganizationRole
        : await readInternalMembershipRole(internalOrganizationId, userId);
  } catch (error) {
    console.error("[authorization] Clerk membership lookup failed", error);
    return {
      userId,
      sessionId,
      role: null,
      internalOrganizationId,
      internalMembershipRole: null,
      activeOrganizationId,
      activeOrganizationRole,
      needsOrganizationActivation: false,
      resolution: "unavailable",
    };
  }

  const hasMembership = internalMembershipRole !== null;
  const role = roleFromInternalMembership(
    internalMembershipRole,
    hasMembership,
  );
  const isStaff = role === "admin" || role === "operator";

  return {
    userId,
    sessionId,
    role,
    internalOrganizationId,
    internalMembershipRole,
    activeOrganizationId,
    activeOrganizationRole,
    needsOrganizationActivation:
      isStaff &&
      (activeOrganizationId !== internalOrganizationId ||
        activeOrganizationRole !== internalMembershipRole),
    resolution:
      hasMembership && !role ? "invalid_membership_role" : "resolved",
  };
}

export function evaluateAuthorization(
  context: ServerAuthorizationContext,
  allowedRoles: readonly UserRole[],
): AuthorizationDecision {
  if (
    context.resolution === "not_configured" ||
    context.resolution === "unavailable"
  ) {
    return {
      ok: false,
      status: 503,
      error: "Authorization service unavailable.",
    };
  }
  if (!context.userId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }
  if (!context.role || !allowedRoles.includes(context.role)) {
    return { ok: false, status: 403, error: "Insufficient permissions." };
  }
  return {
    ok: true,
    context: context as AuthorizedServerAuthorizationContext,
  };
}

export async function authorizeServerRoles(
  allowedRoles: readonly UserRole[],
) {
  return evaluateAuthorization(
    await getServerAuthorizationContext(),
    allowedRoles,
  );
}
