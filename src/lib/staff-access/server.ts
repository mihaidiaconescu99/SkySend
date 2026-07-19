import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStaffAccessConfig } from "@/lib/staff-access/config";
import { verifyCloudflareAccessToken } from "@/lib/staff-access/cloudflare";
import {
  findClerkUserByExactEmail,
  getClerkOrganizationRole,
  revokeClerkUserSessions,
  syncExternalStaffIdentity,
} from "@/lib/staff-access/identity";
import { sendStaffAccessEmail } from "@/lib/staff-access/notifications";
import type { Json } from "@/types/database";
import type {
  AccessCapability,
  AccessKind,
  AccessRequestStatus,
  AdminAccessDuration,
  AdminAccessRequestRecord,
  StaffAccessContext,
  StaffRole,
  StaffUserLookup,
} from "@/types/staff-access";

type AssignmentRow = {
  id: string;
  profile_id: string;
  role: "operator" | "admin";
  access_kind: AccessKind;
  status: "pending_sync" | "active" | "revoked" | "expired" | "failed";
  fallback_role: "client" | "operator";
  expires_at: string | null;
  created_at: string;
};

function capabilitiesFor(role: StaffRole, permanentAdmin: boolean): AccessCapability[] {
  const capabilities: AccessCapability[] = ["view_client_workspace"];
  if (role === "operator" || role === "admin") capabilities.push("view_operator_workspace");
  if (role === "operator") capabilities.push("request_admin_access");
  if (role === "admin") capabilities.push("view_admin_workspace");
  if (permanentAdmin) capabilities.push("manage_staff_access");
  return capabilities;
}

async function getProfileByClerkUserId(clerkUserId: string) {
  const { data, error } = await createAdminSupabaseClient()
    .from("profiles")
    .select("id, clerk_user_id, email, full_name, role")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getCurrentAssignment(profileId: string): Promise<AssignmentRow | null> {
  const { data, error } = await createAdminSupabaseClient()
    .from("staff_access_assignments")
    .select("id, profile_id, role, access_kind, status, fallback_role, expires_at, created_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AssignmentRow | null;
}

export async function recordStaffAccessAudit(input: {
  actorProfileId: string | null;
  actorRole: StaffRole | "system";
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
}) {
  let requestContext: { ipAddress?: string; userAgent?: string } = {};
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const connectingIp = requestHeaders.get("cf-connecting-ip")?.trim();
    const userAgent = requestHeaders.get("user-agent")?.trim();
    requestContext = {
      ...(connectingIp || forwardedFor ? { ipAddress: connectingIp || forwardedFor } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  } catch {
  }

  const { error } = await createAdminSupabaseClient().from("audit_events").insert({
    actor_profile_id: input.actorProfileId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    changes: {
      ...input.changes,
      ...(Object.keys(requestContext).length > 0 ? { requestContext } : {}),
    } as Json,
  });
  if (error) console.error("[staff-access] audit insert failed", error.message);
}

async function restoreExpiredAssignment(assignment: AssignmentRow, profile: { clerk_user_id: string; email: string }) {
  const db = createAdminSupabaseClient();
  await db.from("staff_access_assignments")
    .update({ status: "expired", revoked_at: new Date().toISOString(), revoked_reason: "Expirare automată" })
    .eq("id", assignment.id)
    .eq("status", "active");

  let restoredAssignmentId: string | null = null;
  if (assignment.fallback_role === "operator") {
    const { data, error } = await db.from("staff_access_assignments").insert({
      profile_id: assignment.profile_id,
      role: "operator",
      access_kind: "permanent",
      fallback_role: "client",
      status: "active",
      source: "direct",
      reason: "Restaurare automată după expirarea accesului Admin",
      activated_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    restoredAssignmentId = data.id;
  }
  await db.from("profiles").update({ role: assignment.fallback_role }).eq("id", assignment.profile_id);
  const { data: job } = await db.from("staff_access_sync_jobs").insert({
    assignment_id: restoredAssignmentId,
    profile_id: assignment.profile_id,
    operation: "expire",
    payload: { expiredAssignmentId: assignment.id, restoredRole: assignment.fallback_role },
  }).select("id").single();

  try {
    await syncExternalStaffIdentity({
      clerkUserId: profile.clerk_user_id,
      email: profile.email,
      role: assignment.fallback_role,
    });
    if (job) await db.from("staff_access_sync_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
  } catch (error) {
    if (job) await db.from("staff_access_sync_jobs").update({ status: "failed", attempts: 1, last_error: error instanceof Error ? error.message : "Unknown sync error" }).eq("id", job.id);
  }
  await revokeClerkUserSessions(profile.clerk_user_id);
  await createAdminSupabaseClient().from("admin_access_requests")
    .update({ status: "expired" })
    .eq("assignment_id", assignment.id)
    .eq("status", "approved");
  await notifyProfile(
    assignment.profile_id,
    "Accesul Admin a expirat",
    assignment.fallback_role === "operator"
      ? "Ai revenit automat la rolul Operator."
      : "Contul tău a revenit la rolul Client.",
    assignment.fallback_role === "operator" ? "/operator" : "/client",
  );
  await sendStaffAccessEmail({
    to: profile.email,
    subject: "Accesul Admin SkySend a expirat",
    message: assignment.fallback_role === "operator"
      ? "Ai revenit automat la rolul Operator."
      : "Contul tău a revenit la rolul Client.",
    actionUrl: assignment.fallback_role === "operator" ? "/operator" : "/client",
    idempotencyKey: `staff-expired-${assignment.id}`,
  });
  await recordStaffAccessAudit({
    actorProfileId: null,
    actorRole: "system",
    action: "staff_access_expired",
    entityType: "staff_access_assignments",
    entityId: assignment.id,
    changes: { restoredRole: assignment.fallback_role },
  });
}

export async function getCurrentStaffAccess(): Promise<StaffAccessContext | null> {
  const { userId } = await auth();
  if (!userId) return null;
  let profile = await getProfileByClerkUserId(userId);
  if (!profile) {
    const user = await currentUser();
    const primary = user?.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
      ?? user?.emailAddresses[0];
    if (!user || !primary?.emailAddress) return null;
    profile = await ensureProfile({
      clerkUserId: userId,
      email: primary.emailAddress,
      fullName: user.fullName,
    });
  }

  let assignment = await getCurrentAssignment(profile.id);
  if (assignment?.access_kind === "temporary" && assignment.expires_at && Date.parse(assignment.expires_at) <= Date.now()) {
    await restoreExpiredAssignment(assignment, profile);
    assignment = await getCurrentAssignment(profile.id);
  }

  const role: StaffRole = assignment?.role ?? "client";
  const permanentAdmin = role === "admin" && assignment?.access_kind === "permanent";
  const expectedClerkRole = role === "admin" ? "org:admin" : role === "operator" ? "org:member" : null;
  const actualClerkRole = role === "client" ? null : await getClerkOrganizationRole(userId);
  const hasOrgConfig = Boolean(getStaffAccessConfig().clerkOrganizationId);
  const integrationMismatch = role !== "client" && (!hasOrgConfig || actualClerkRole !== expectedClerkRole);

  return {
    clerkUserId: userId,
    profileId: profile.id,
    email: profile.email,
    role,
    accessKind: assignment?.access_kind ?? null,
    assignmentId: assignment?.id ?? null,
    expiresAt: assignment?.expires_at ?? null,
    isPermanentAdmin: permanentAdmin,
    capabilities: capabilitiesFor(role, permanentAdmin),
    integrationMismatch,
  };
}

export async function requirePermanentAdminAccess(request?: Request) {
  const token = request
    ? request.headers.get("cf-access-jwt-assertion")
    : (await headers()).get("cf-access-jwt-assertion");
  const cloudflare = await verifyCloudflareAccessToken(token);
  if (!cloudflare.ok) return { ok: false as const, status: 403 as const, error: cloudflare.error };

  const access = await getCurrentStaffAccess();
  if (!access) return { ok: false as const, status: 401 as const, error: "Autentificare necesară." };
  if (!access.isPermanentAdmin) return { ok: false as const, status: 403 as const, error: "Este necesar un administrator permanent." };
  if (getStaffAccessConfig().enforcement === "strict" && access.integrationMismatch) {
    return { ok: false as const, status: 403 as const, error: "Rolul Clerk nu corespunde accesului din baza de date." };
  }
  return { ok: true as const, access, cloudflarePayload: cloudflare.payload };
}

export async function lookupStaffUser(email: string, actor: StaffAccessContext): Promise<StaffUserLookup | null> {
  const clerkUser = await findClerkUserByExactEmail(email);
  await recordStaffAccessAudit({
    actorProfileId: actor.profileId,
    actorRole: actor.role,
    action: "staff_user_lookup",
    entityType: "profiles",
    entityId: email.trim().toLowerCase(),
    changes: { found: Boolean(clerkUser) },
  });
  if (!clerkUser) return null;
  const normalized = email.trim().toLowerCase();
  const address = clerkUser.emailAddresses.find((item) => item.emailAddress.trim().toLowerCase() === normalized);
  const profile = await getProfileByClerkUserId(clerkUser.id);
  const assignment = profile ? await getCurrentAssignment(profile.id) : null;
  return {
    clerkUserId: clerkUser.id,
    profileId: profile?.id ?? null,
    email: address?.emailAddress ?? normalized,
    fullName: clerkUser.fullName,
    imageUrl: clerkUser.imageUrl || null,
    emailVerified: address?.verification?.status === "verified",
    role: assignment?.role ?? "client",
    accessKind: assignment?.access_kind ?? null,
    assignmentId: assignment?.id ?? null,
    expiresAt: assignment?.expires_at ?? null,
    assignmentStatus: assignment?.status ?? null,
  };
}

async function ensureProfile(input: { clerkUserId: string; email: string; fullName: string | null }) {
  const db = createAdminSupabaseClient();
  const { data, error } = await db.rpc("ensure_profile_exists", {
    p_clerk_user_id: input.clerkUserId,
    p_email: input.email,
    p_full_name: input.fullName ?? undefined,
  });
  if (error || !data) throw error ?? new Error("Profilul nu a putut fi sincronizat.");
  const profile = await getProfileByClerkUserId(input.clerkUserId);
  if (!profile) throw new Error("Profilul sincronizat nu a fost găsit.");
  return profile;
}

export async function assignStaffRole(input: {
  targetEmail: string;
  role: "operator" | "admin";
  accessKind: AccessKind;
  durationMinutes?: AdminAccessDuration;
  reason: string;
  actor: StaffAccessContext;
  source?: "direct" | "request";
  requestId?: string;
}) {
  const clerkUser = await findClerkUserByExactEmail(input.targetEmail);
  if (!clerkUser) throw new Error("Cont inexistent.");
  const normalized = input.targetEmail.trim().toLowerCase();
  const address = clerkUser.emailAddresses.find((item) => item.emailAddress.trim().toLowerCase() === normalized);
  if (!address || address.verification?.status !== "verified") throw new Error("Emailul contului nu este verificat.");
  const profile = await ensureProfile({ clerkUserId: clerkUser.id, email: address.emailAddress, fullName: clerkUser.fullName });
  const db = createAdminSupabaseClient();
  const previous = await getCurrentAssignment(profile.id);
  const fallbackRole = input.role === "admin" && input.accessKind === "temporary" && previous?.role === "operator"
    ? "operator"
    : "client";
  const expiresAt = input.accessKind === "temporary"
    ? new Date(Date.now() + (input.durationMinutes ?? 1440) * 60_000).toISOString()
    : null;

  if (previous) {
    await db.from("staff_access_assignments").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_profile_id: input.actor.profileId, revoked_reason: `Înlocuit cu rolul ${input.role}` }).eq("id", previous.id);
  }
  const { data: assignment, error } = await db.from("staff_access_assignments").insert({
    profile_id: profile.id,
    role: input.role,
    access_kind: input.accessKind,
    fallback_role: fallbackRole,
    status: "pending_sync",
    source: input.source ?? "direct",
    reason: input.reason,
    expires_at: expiresAt,
    granted_by_profile_id: input.actor.profileId,
  }).select("id").single();
  if (error) throw error;
  const { data: job } = await db.from("staff_access_sync_jobs").insert({
    assignment_id: assignment.id,
    profile_id: profile.id,
    operation: previous ? "change_role" : "activate",
    payload: { role: input.role, accessKind: input.accessKind, expiresAt },
  }).select("id").single();

  try {
    await syncExternalStaffIdentity({ clerkUserId: clerkUser.id, email: address.emailAddress, role: input.role });
    await db.from("staff_access_assignments").update({ status: "active", activated_at: new Date().toISOString(), external_sync_error: null }).eq("id", assignment.id);
    await db.from("profiles").update({ role: input.role }).eq("id", profile.id);
    if (job) await db.from("staff_access_sync_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Sincronizare externă eșuată.";
    await db.from("staff_access_assignments").update({ status: "failed", external_sync_error: message }).eq("id", assignment.id);
    if (previous) await db.from("staff_access_assignments").update({ status: "active", revoked_at: null, revoked_by_profile_id: null, revoked_reason: null }).eq("id", previous.id);
    await db.from("profiles").update({ role: previous?.role ?? "client" }).eq("id", profile.id);
    if (job) await db.from("staff_access_sync_jobs").update({ status: "failed", attempts: 1, last_error: message }).eq("id", job.id);
    throw new Error(message);
  }

  await recordStaffAccessAudit({
    actorProfileId: input.actor.profileId,
    actorRole: input.actor.role,
    action: "staff_role_assigned",
    entityType: "staff_access_assignments",
    entityId: assignment.id,
    changes: {
      targetProfileId: profile.id,
      previousRole: previous?.role ?? "client",
      role: input.role,
      accessKind: input.accessKind,
      expiresAt,
      reason: input.reason,
      requestId: input.requestId ?? null,
    },
  });
  await revokeClerkUserSessions(clerkUser.id);
  await notifyProfile(profile.id, "Acces actualizat", `Rolul tău este acum ${input.role === "admin" ? "Admin" : "Operator"}.`, "/auth/continue");
  await sendStaffAccessEmail({
    to: address.emailAddress,
    subject: "Accesul SkySend a fost actualizat",
    message: `Rolul tău este acum ${input.role === "admin" ? "Admin" : "Operator"}${expiresAt ? ` până la ${new Date(expiresAt).toLocaleString("ro-RO")}` : ""}.`,
    actionUrl: "/auth/continue",
    idempotencyKey: `staff-role-${assignment.id}`,
  });
  return { assignmentId: assignment.id, profileId: profile.id, expiresAt };
}

export async function revokeStaffAccess(input: { targetEmail: string; reason: string; actor: StaffAccessContext }) {
  const clerkUser = await findClerkUserByExactEmail(input.targetEmail);
  if (!clerkUser) throw new Error("Cont inexistent.");
  const profile = await getProfileByClerkUserId(clerkUser.id);
  if (!profile) return { role: "client" as const };
  const assignment = await getCurrentAssignment(profile.id);
  if (!assignment) return { role: "client" as const };
  if (assignment.role === "admin" && assignment.access_kind === "permanent") {
    const { count } = await createAdminSupabaseClient().from("staff_access_assignments")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin").eq("access_kind", "permanent").eq("status", "active");
    if ((count ?? 0) <= 1) throw new Error("Ultimul administrator permanent nu poate fi eliminat.");
  }

  const db = createAdminSupabaseClient();
  await db.from("staff_access_assignments").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_profile_id: input.actor.profileId, revoked_reason: input.reason }).eq("id", assignment.id);
  await db.from("profiles").update({ role: "client" }).eq("id", profile.id);
  const { data: job } = await db.from("staff_access_sync_jobs").insert({ assignment_id: assignment.id, profile_id: profile.id, operation: "revoke", payload: { reason: input.reason } }).select("id").single();
  try {
    await syncExternalStaffIdentity({ clerkUserId: clerkUser.id, email: profile.email, role: "client" });
    if (job) await db.from("staff_access_sync_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
  } catch (caught) {
    if (job) await db.from("staff_access_sync_jobs").update({ status: "failed", attempts: 1, last_error: caught instanceof Error ? caught.message : "Unknown sync error" }).eq("id", job.id);
  }
  await revokeClerkUserSessions(clerkUser.id);
  await recordStaffAccessAudit({ actorProfileId: input.actor.profileId, actorRole: input.actor.role, action: "staff_access_revoked", entityType: "staff_access_assignments", entityId: assignment.id, changes: { targetProfileId: profile.id, reason: input.reason } });
  await notifyProfile(profile.id, "Acces intern eliminat", "Contul tău a revenit la rolul Client.", "/client");
  await sendStaffAccessEmail({ to: profile.email, subject: "Accesul intern SkySend a fost eliminat", message: "Contul tău a revenit la rolul Client.", actionUrl: "/client", idempotencyKey: `staff-revoke-${assignment.id}` });
  return { role: "client" as const };
}

async function notifyProfile(profileId: string, title: string, message: string, actionUrl: string) {
  const { error } = await createAdminSupabaseClient().from("notifications").insert({
    profile_id: profileId,
    title,
    message,
    type: "system",
    action_url: actionUrl,
    metadata: { securityEvent: true },
  });
  if (error) console.error("[staff-access] notification failed", error.message);
}

async function permanentAdmins() {
  const db = createAdminSupabaseClient();
  const { data: assignments, error } = await db.from("staff_access_assignments")
    .select("profile_id")
    .eq("role", "admin").eq("access_kind", "permanent").eq("status", "active");
  if (error) throw error;
  const ids = assignments.map((item) => item.profile_id);
  if (!ids.length) return [];
  const { data: profiles, error: profilesError } = await db.from("profiles").select("id, email").in("id", ids);
  if (profilesError) throw profilesError;
  return profiles;
}

export async function createAdminAccessRequest(input: { access: StaffAccessContext; duration: AdminAccessDuration; reason: string }) {
  if (input.access.role !== "operator") throw new Error("Numai Operatorii pot solicita acces Admin.");
  const db = createAdminSupabaseClient();
  const { data, error } = await db.from("admin_access_requests").insert({
    requester_profile_id: input.access.profileId,
    requested_duration_minutes: input.duration,
    reason: input.reason.trim(),
  }).select("id, created_at").single();
  if (error?.code === "23505") throw new Error("Ai deja o cerere în așteptare.");
  if (error) throw error;
  const admins = await permanentAdmins();
  await Promise.all(admins.map(async (admin) => {
    await notifyProfile(admin.id, "Cerere nouă de acces Admin", `${input.access.email} solicită acces temporar.`, "/admin/access?tab=requests");
    await sendStaffAccessEmail({ to: admin.email, subject: "Cerere nouă de acces Admin", message: `${input.access.email} solicită acces Admin pentru ${input.duration} minute.`, actionUrl: "/admin/access?tab=requests", idempotencyKey: `admin-request-${data.id}-${admin.id}` });
  }));
  await recordStaffAccessAudit({ actorProfileId: input.access.profileId, actorRole: input.access.role, action: "admin_access_requested", entityType: "admin_access_requests", entityId: data.id, changes: { duration: input.duration, reason: input.reason } });
  return data;
}

export async function getOwnAdminAccessRequest(access: StaffAccessContext) {
  const { data, error } = await createAdminSupabaseClient().from("admin_access_requests")
    .select("id, requested_duration_minutes, reason, status, review_note, created_at, decided_at")
    .eq("requester_profile_id", access.profileId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function cancelOwnAdminAccessRequest(access: StaffAccessContext) {
  const { data, error } = await createAdminSupabaseClient().from("admin_access_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("requester_profile_id", access.profileId).eq("status", "pending")
    .select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Nu există o cerere în așteptare.");
  return data;
}

export async function listAdminAccessRequests(): Promise<AdminAccessRequestRecord[]> {
  const db = createAdminSupabaseClient();
  const { data, error } = await db.from("admin_access_requests")
    .select("id, requester_profile_id, requested_duration_minutes, reason, status, review_note, created_at, decided_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const ids = [...new Set(data.map((item) => item.requester_profile_id))];
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return data.map((item) => ({
    id: item.id,
    requesterProfileId: item.requester_profile_id,
    requesterName: byId.get(item.requester_profile_id)?.full_name ?? null,
    requesterEmail: byId.get(item.requester_profile_id)?.email ?? "Cont necunoscut",
    requestedDurationMinutes: item.requested_duration_minutes as AdminAccessDuration,
    reason: item.reason,
    status: item.status as AccessRequestStatus,
    reviewNote: item.review_note,
    createdAt: item.created_at,
    decidedAt: item.decided_at,
  }));
}

export async function decideAdminAccessRequest(input: { requestId: string; decision: "approve" | "reject"; note: string; actor: StaffAccessContext }) {
  const db = createAdminSupabaseClient();
  const { data: request, error } = await db.from("admin_access_requests")
    .select("id, requester_profile_id, requested_duration_minutes, reason, status")
    .eq("id", input.requestId).single();
  if (error) throw error;
  if (request.status !== "pending") throw new Error("Cererea nu mai este în așteptare.");
  const { data: profile, error: profileError } = await db.from("profiles").select("email").eq("id", request.requester_profile_id).single();
  if (profileError) throw profileError;

  let assignmentId: string | null = null;
  if (input.decision === "approve") {
    const assignment = await assignStaffRole({
      targetEmail: profile.email,
      role: "admin",
      accessKind: "temporary",
      durationMinutes: request.requested_duration_minutes as AdminAccessDuration,
      reason: `Cerere aprobată: ${request.reason}`,
      actor: input.actor,
      source: "request",
      requestId: request.id,
    });
    assignmentId = assignment.assignmentId;
  }
  const status = input.decision === "approve" ? "approved" : "rejected";
  const { error: updateError } = await db.from("admin_access_requests").update({
    status,
    reviewed_by_profile_id: input.actor.profileId,
    review_note: input.note,
    assignment_id: assignmentId,
    decided_at: new Date().toISOString(),
  }).eq("id", request.id).eq("status", "pending");
  if (updateError) throw updateError;
  if (input.decision === "reject") {
    await notifyProfile(request.requester_profile_id, "Cerere de acces respinsă", input.note, "/admin");
    await sendStaffAccessEmail({ to: profile.email, subject: "Cererea de acces Admin a fost respinsă", message: input.note, actionUrl: "/admin", idempotencyKey: `admin-request-rejected-${request.id}` });
  }
  await recordStaffAccessAudit({ actorProfileId: input.actor.profileId, actorRole: input.actor.role, action: `admin_access_${status}`, entityType: "admin_access_requests", entityId: request.id, changes: { note: input.note, assignmentId } });
  return { status, assignmentId };
}

export async function processExpiredAndPendingStaffAccess() {
  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data: expired, error } = await db.from("staff_access_assignments")
    .select("id, profile_id, role, access_kind, status, fallback_role, expires_at, created_at")
    .eq("status", "active")
    .eq("access_kind", "temporary")
    .lte("expires_at", now)
    .limit(100);
  if (error) throw error;
  let expiredCount = 0;
  for (const row of expired as AssignmentRow[]) {
    const { data: profile } = await db.from("profiles").select("clerk_user_id, email").eq("id", row.profile_id).maybeSingle();
    if (!profile) continue;
    await restoreExpiredAssignment(row, profile);
    expiredCount += 1;
  }

  const { data: failedJobs } = await db.from("staff_access_sync_jobs")
    .select("id, profile_id, attempts")
    .eq("status", "failed")
    .lte("available_at", now)
    .lt("attempts", 5)
    .limit(50);
  let reconciled = 0;
  for (const job of failedJobs ?? []) {
    const { data: profile } = await db.from("profiles").select("clerk_user_id, email").eq("id", job.profile_id).maybeSingle();
    if (!profile) continue;
    const current = await getCurrentAssignment(job.profile_id);
    const desiredRole: StaffRole = current?.role ?? "client";
    try {
      await syncExternalStaffIdentity({ clerkUserId: profile.clerk_user_id, email: profile.email, role: desiredRole });
      await db.from("staff_access_sync_jobs").update({ status: "completed", attempts: job.attempts + 1, completed_at: now, last_error: null }).eq("id", job.id);
      reconciled += 1;
    } catch (caught) {
      const attempts = job.attempts + 1;
      await db.from("staff_access_sync_jobs").update({
        attempts,
        available_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
        last_error: caught instanceof Error ? caught.message : "Unknown sync error",
      }).eq("id", job.id);
    }
  }
  return { expired: expiredCount, reconciled };
}
