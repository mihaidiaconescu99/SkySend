import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { getStaffAccessConfig } from "@/lib/staff-access/config";
import { syncCloudflareStaffEmail } from "@/lib/staff-access/cloudflare";
import type { StaffRole } from "@/types/staff-access";

export async function findClerkUserByExactEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const client = await clerkClient();
  const response = await client.users.getUserList({ emailAddress: [normalized], limit: 10 });
  return response.data.find((user) =>
    user.emailAddresses.some((address) => address.emailAddress.trim().toLowerCase() === normalized),
  ) ?? null;
}

export async function getClerkOrganizationRole(userId: string) {
  const organizationId = getStaffAccessConfig().clerkOrganizationId;
  if (!organizationId) return null;
  const client = await clerkClient();
  const response = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 10,
  });
  return response.data[0]?.role ?? null;
}

export async function syncExternalStaffIdentity(input: {
  clerkUserId: string;
  email: string;
  role: StaffRole;
}) {
  const config = getStaffAccessConfig();
  if (!config.clerkOrganizationId) {
    if (config.enforcement === "strict") throw new Error("Clerk internal organization is not configured.");
  } else {
    const client = await clerkClient();
    const currentRole = await getClerkOrganizationRole(input.clerkUserId);
    if (input.role === "client") {
      if (currentRole) {
        await client.organizations.deleteOrganizationMembership({
          organizationId: config.clerkOrganizationId,
          userId: input.clerkUserId,
        });
      }
    } else {
      const desiredRole = input.role === "admin" ? "org:admin" : "org:member";
      if (!currentRole) {
        await client.organizations.createOrganizationMembership({
          organizationId: config.clerkOrganizationId,
          userId: input.clerkUserId,
          role: desiredRole,
        });
      } else if (currentRole !== desiredRole) {
        await client.organizations.updateOrganizationMembership({
          organizationId: config.clerkOrganizationId,
          userId: input.clerkUserId,
          role: desiredRole,
        });
      }
    }

    await client.users.updateUserMetadata(input.clerkUserId, {
      publicMetadata: { role: input.role },
    });
  }

  await syncCloudflareStaffEmail(input.email, input.role !== "client");
}

export async function revokeClerkUserSessions(userId: string) {
  const client = await clerkClient();
  const sessions = await client.sessions.getSessionList({ userId, limit: 100 });
  await Promise.allSettled(
    sessions.data
      .filter((session) => session.status === "active")
      .map((session) => client.sessions.revokeSession(session.id)),
  );
}
