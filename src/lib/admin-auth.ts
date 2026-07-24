import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { authorizeServerRoles } from "@/lib/server-authorization";
import type { Profile } from "@/types/profile";

export type AdminAuthSuccess = {
  ok: true;
  clerkUserId: string;
  profile: Profile;
};
export type AdminAuthFailure = {
  ok: false;
  status: 401 | 403 | 404 | 502 | 503;
  error: string;
};

export async function requireAdminPanelUser(): Promise<
  AdminAuthSuccess | AdminAuthFailure
> {
  const authorization = await authorizeServerRoles(["admin"]);
  if (!authorization.ok) return authorization;

  const user = await currentUser();
  if (!user || user.id !== authorization.context.userId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }
  const primaryEmail =
    user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];
  if (!primaryEmail?.emailAddress) {
    return { ok: false, status: 404, error: "Verified identity not found." };
  }

  const repository = new ProfilesRepository(createAdminSupabaseClient());
  const profileResult = await repository.findOrCreateByClerkUserId(user.id, {
    clerkUserId: user.id,
    email: primaryEmail.emailAddress,
    fullName: user.fullName,
    role: "admin",
  });
  if (!profileResult.ok) {
    return { ok: false, status: 502, error: "Profile lookup failed." };
  }

  let profile = profileResult.data;
  if (profile.role !== "admin") {
    const updateResult = await repository.updateById(profile.id, {
      role: "admin",
    });
    if (!updateResult.ok) {
      return { ok: false, status: 502, error: "Profile sync failed." };
    }
    profile = updateResult.data;
  }

  return {
    ok: true,
    clerkUserId: authorization.context.userId,
    profile,
  };
}
