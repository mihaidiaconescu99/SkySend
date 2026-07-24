import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOrderRow,
  buildProfileRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const roleGuardMock = vi.hoisted(() => ({
  role: "client" as "client" | "operator" | "admin",
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: clerkMock.auth,
}));

vi.mock("@/lib/api/role-guard", () => ({
  authorizeApiRequest: vi.fn(async (allowedRoles: string[]) => {
    const { userId } = await clerkMock.auth();
    if (!userId) {
      return {
        ok: false,
        response: Response.json(
          { error: "Authentication required." },
          { status: 401 },
        ),
      };
    }
    if (!allowedRoles.includes(roleGuardMock.role)) {
      return {
        ok: false,
        response: Response.json(
          { error: "Insufficient permissions." },
          { status: 403 },
        ),
      };
    }
    return {
      ok: true,
      context: { userId, role: roleGuardMock.role },
    };
  }),
}));

const adminMock = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: adminMock.createAdminSupabaseClient,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("@/app/api/client/orders/route");

let store: FakeStore;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  adminMock.createAdminSupabaseClient.mockReturnValue(fake.client);
  roleGuardMock.role = "client";
});

afterEach(() => {
  vi.clearAllMocks();
});

function seedProfileForClerk(clerkUserId: string) {
  const profileId = "11111111-1111-1111-1111-111111111111";
  store.seedProfile(
    buildProfileRow({
      id: profileId,
      clerk_user_id: clerkUserId,
      email: "client@example.com",
    }),
  );
  return profileId;
}

function seedOrderForProfile(profileId: string, overrides: Record<string, unknown> = {}) {
  store.seedOrder(
    buildOrderRow({
      id: "o-1",
      local_order_id: "SKY-PT-12345",
      sender_profile_id: profileId,
      status: "pending",
      payment_status: "paid",
      ...overrides,
    }),
  );
}

describe("GET /api/client/orders", () => {
  it("returns 401 when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns 403 when an Operator calls a Client API directly", async () => {
    roleGuardMock.role = "operator";
    clerkMock.auth.mockResolvedValue({ userId: "user_operator" });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(adminMock.createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 404 when the profile is missing", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_orphan" });

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("returns the client's own orders (paid order is visible)", async () => {

    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const profileId = seedProfileForClerk("user_client");
    seedOrderForProfile(profileId, {
      status: "pending",
      payment_status: "paid",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].id).toBe("SKY-PT-12345");

    expect(body.orders[0].payment.status).toBe("paid");
    expect(body.created).toHaveLength(1);
    expect(body.created[0].paymentStatus).toBe("paid");
  });

  it("filters by sender_profile_id — another client's orders are excluded", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const ownProfileId = seedProfileForClerk("user_client");

    const otherProfileId = "22222222-2222-2222-2222-222222222222";
    store.seedProfile(
      buildProfileRow({
        id: otherProfileId,
        clerk_user_id: "user_other",
        email: "other@example.com",
      }),
    );

    seedOrderForProfile(ownProfileId, {
      id: "o-own",
      local_order_id: "SKY-PT-OWN",
    });
    seedOrderForProfile(otherProfileId, {
      id: "o-other",
      local_order_id: "SKY-PT-OTHER",
      sender_profile_id: otherProfileId,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].id).toBe("SKY-PT-OWN");
  });

  it("returns empty arrays when the client has no orders", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_empty" });
    seedProfileForClerk("user_empty");

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders).toEqual([]);
    expect(body.created).toEqual([]);
  });

  it("returns 502 when the orders list query fails", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    seedProfileForClerk("user_client");
    store.injectErrorOnNext("select", {
      code: "P0001",
      message: "forced failure",
    });

    const response = await GET();

    expect(response.status).toBe(502);
  });
});
