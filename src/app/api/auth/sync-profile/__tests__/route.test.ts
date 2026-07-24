import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildProfileRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: clerkMock.auth,
  currentUser: clerkMock.currentUser,
}));

const authorizationMock = vi.hoisted(() => ({
  getServerAuthorizationContext: vi.fn(),
}));

vi.mock("@/lib/server-authorization", () => ({
  getServerAuthorizationContext:
    authorizationMock.getServerAuthorizationContext,
}));

const adminMock = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: adminMock.createAdminSupabaseClient,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const { GET, POST } = await import(
  "@/app/api/auth/sync-profile/route"
);

interface AttachOptions {

  rpcProfileId?: string | null;
  rpcError?: { code: string; message: string } | null;
}

let store: FakeStore;

function attachFakeSupabase(options: AttachOptions = {}): void {
  const fake = createFakeSupabase();
  store = fake.store;

  (
    fake.client as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { code: string; message: string } | null }>;
    }
  ).rpc = vi.fn(async () => {
    if (options.rpcError) {
      return { data: null, error: options.rpcError };
    }
    return { data: options.rpcProfileId ?? null, error: null };
  });

  adminMock.createAdminSupabaseClient.mockReturnValue(fake.client);
}

function clerkUser(overrides: {
  id?: string;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} = {}) {
  return {
    id: overrides.id ?? "user_x",
    emailAddresses:
      overrides.email === null
        ? []
        : [{ emailAddress: overrides.email ?? "ana@example.com" }],
    fullName: overrides.fullName ?? "Ana Pop",
    firstName: overrides.firstName ?? "Ana",
    lastName: overrides.lastName ?? "Pop",
  };
}

beforeEach(() => {
  clerkMock.auth.mockReset();
  clerkMock.currentUser.mockReset();
  adminMock.createAdminSupabaseClient.mockReset();
  authorizationMock.getServerAuthorizationContext.mockImplementation(
    async () => {
      const { userId } = await clerkMock.auth();
      return {
        userId: userId ?? null,
        sessionId: userId ? "session_test" : null,
        role: userId ? "client" : null,
        internalOrganizationId: "org_test",
        internalMembershipRole: null,
        activeOrganizationId: null,
        activeOrganizationRole: null,
        needsOrganizationActivation: false,
        resolution: "resolved",
      };
    },
  );
});

describe("POST /api/auth/sync-profile", () => {
  it("returns 200 and the mapped Profile when ensure_profile_exists creates a new row", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_new" });
    clerkMock.currentUser.mockResolvedValue(
      clerkUser({
        id: "user_new",
        email: "new@example.com",
        fullName: "New User",
      }),
    );

    const profileId = "11111111-1111-1111-1111-111111111111";
    attachFakeSupabase({ rpcProfileId: profileId });

    store.seedProfile(
      buildProfileRow({
        id: profileId,
        clerk_user_id: "user_new",
        email: "new@example.com",
        full_name: "New User",
      }),
    );

    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toMatchObject({
      id: profileId,
      clerkUserId: "user_new",
      email: "new@example.com",
      fullName: "New User",
      role: "client",
    });
  });

  it("returns 200 when ensure_profile_exists finds an existing row (idempotent)", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_existing" });
    clerkMock.currentUser.mockResolvedValue(
      clerkUser({
        id: "user_existing",
        email: "exist@example.com",
        fullName: "Exist",
      }),
    );

    const profileId = "22222222-2222-2222-2222-222222222222";
    attachFakeSupabase({ rpcProfileId: profileId });
    store.seedProfile(
      buildProfileRow({
        id: profileId,
        clerk_user_id: "user_existing",
        email: "exist@example.com",
        full_name: "Exist",
      }),
    );

    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.id).toBe(profileId);
  });

  it("returns 401 unauthenticated when there is no Clerk session", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(adminMock.createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("does not initialize service-role access when authorization is unavailable", async () => {
    authorizationMock.getServerAuthorizationContext.mockResolvedValue({
      userId: "user_x",
      sessionId: "session_x",
      role: null,
      internalOrganizationId: "org_test",
      internalMembershipRole: null,
      activeOrganizationId: null,
      activeOrganizationRole: null,
      needsOrganizationActivation: false,
      resolution: "unavailable",
    });

    const response = await POST();

    expect(response.status).toBe(503);
    expect(adminMock.createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 401 user_not_found when auth() returned a userId but currentUser() resolves null", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_phantom" });
    clerkMock.currentUser.mockResolvedValue(null);

    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "user_not_found" });
  });

  it("returns 422 missing_email when the Clerk user has no primary email", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_x" });
    clerkMock.currentUser.mockResolvedValue(clerkUser({ email: null }));

    const response = await POST();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "missing_email" });
  });

  it("composes fullName from firstName + lastName when fullName is absent", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_compose" });
    clerkMock.currentUser.mockResolvedValue(
      clerkUser({
        id: "user_compose",
        email: "compose@example.com",
        fullName: null,
        firstName: "Ana",
        lastName: "Pop",
      }),
    );

    const profileId = "33333333-3333-3333-3333-333333333333";
    attachFakeSupabase({ rpcProfileId: profileId });
    store.seedProfile(
      buildProfileRow({
        id: profileId,
        clerk_user_id: "user_compose",
        email: "compose@example.com",
        full_name: "Ana Pop",
      }),
    );

    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.fullName).toBe("Ana Pop");

    const rpcFn = adminMock.createAdminSupabaseClient.mock.results[0]?.value
      .rpc as ReturnType<typeof vi.fn>;
    expect(rpcFn).toHaveBeenCalledWith("ensure_profile_exists", {
      p_clerk_user_id: "user_compose",
      p_email: "compose@example.com",
      p_full_name: "Ana Pop",
    });
  });

  it("projects the verified Clerk organization role into profiles.role", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    clerkMock.currentUser.mockResolvedValue(
      clerkUser({
        id: "user_admin",
        email: "admin@example.com",
        fullName: "Admin SkySend",
      }),
    );
    authorizationMock.getServerAuthorizationContext.mockResolvedValue({
      userId: "user_admin",
      sessionId: "session_admin",
      role: "admin",
      internalOrganizationId: "org_test",
      internalMembershipRole: "org:admin",
      activeOrganizationId: "org_test",
      activeOrganizationRole: "org:admin",
      needsOrganizationActivation: false,
      resolution: "resolved",
    });
    const profileId = "44444444-4444-4444-4444-444444444444";
    attachFakeSupabase({ rpcProfileId: profileId });
    store.seedProfile(
      buildProfileRow({
        id: profileId,
        clerk_user_id: "user_admin",
        email: "admin@example.com",
        role: "client",
      }),
    );

    const response = await POST();

    expect(response.status).toBe(200);
    expect((await response.json()).profile.role).toBe("admin");
    expect(store.rows.get(profileId)?.role).toBe("admin");
  });

  it("returns 500 sync_failed when ensure_profile_exists RPC errors out", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_x" });
    clerkMock.currentUser.mockResolvedValue(clerkUser());
    attachFakeSupabase({
      rpcError: { code: "P0001", message: "clerk_user_id required" },
    });

    const response = await POST();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("sync_failed");
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("clerk_user_id required");
  });

  it("returns 500 sync_inconsistent when RPC returns an id but the row is not visible afterwards", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_x" });
    clerkMock.currentUser.mockResolvedValue(clerkUser());

    attachFakeSupabase({ rpcProfileId: "ghost-id" });

    const response = await POST();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "sync_inconsistent" });
  });

  it("returns 405 for GET requests", async () => {
    const response = GET();
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });
});
