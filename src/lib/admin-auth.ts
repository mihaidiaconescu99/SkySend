import "server-only";

import { headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { getStaffAccessConfig } from "@/lib/staff-access/config";
import { verifyCloudflareAccessToken } from "@/lib/staff-access/cloudflare";
import { getCurrentStaffAccess } from "@/lib/staff-access/server";
import type { Profile } from "@/types/profile";

export type AdminAuthSuccess = { ok: true; clerkUserId: string; profile: Profile };
export type AdminAuthFailure = { ok: false; status: 401 | 403 | 404 | 502; error: string };

export async function requireAdminPanelUser(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const cloudflare = await verifyCloudflareAccessToken((await headers()).get("cf-access-jwt-assertion"));
  if (!cloudflare.ok) return { ok: false, status: 403, error: cloudflare.error };
  const access = await getCurrentStaffAccess();
  if (!access) return { ok: false, status: 401, error: "Authentication required." };
  if (access.role !== "admin") return { ok: false, status: 403, error: "Admin role required." };
  if (getStaffAccessConfig().enforcement === "strict" && access.integrationMismatch) {
    return { ok: false, status: 403, error: "Clerk organization role mismatch." };
  }
  const result = await new ProfilesRepository(createAdminSupabaseClient()).getById(access.profileId);
  if (!result.ok) return { ok: false, status: 502, error: "Profile lookup failed." };
  if (!result.data) return { ok: false, status: 404, error: "Profile not found." };
  return { ok: true, clerkUserId: access.clerkUserId, profile: result.data };
}
