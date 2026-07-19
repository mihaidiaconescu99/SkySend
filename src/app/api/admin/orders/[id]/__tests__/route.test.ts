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

vi.mock("@clerk/nextjs/server", () => ({
  auth: clerkMock.auth,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminPanelUser: async () => {
    const { userId } = await clerkMock.auth();
    if (!userId) return { ok: false, status: 401, error: "Authentication required." };
    const profile = [...store.rows.values()].find((row) => row.clerk_user_id === userId);
    if (!profile) return { ok: false, status: 404, error: "Profile not found." };
    if (profile.role !== "admin") {
      return { ok: false, status: 403, error: "Admin role required." };
    }
    return { ok: true, clerkUserId: userId, profile };
  },
}));

const adminMock = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: adminMock.createAdminSupabaseClient,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
const { PATCH: patchContact } = await import(
  "@/app/api/admin/contact-messages/[id]/route"
);

let store: FakeStore;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  adminMock.createAdminSupabaseClient.mockReturnValue(fake.client);
});

afterEach(() => {
  vi.clearAllMocks();
});

function seedAdmin(clerkUserId = "user_admin") {
  const profileId = "11111111-1111-1111-1111-111111111111";
  store.seedProfile(
    buildProfileRow({
      id: profileId,
      clerk_user_id: clerkUserId,
      email: "admin@example.com",
      role: "admin",
    }),
  );
  return profileId;
}

function seedOrder(overrides: Record<string, unknown> = {}) {
  store.seedOrder(
    buildOrderRow({
      id: "order-1",
      local_order_id: "SKY-PT-1",
      status: "pending",
      payment_status: "pending",
      ...overrides,
    }),
  );
}

async function patchOrder(id: string, body: unknown) {
  return PATCH(
    new Request(`https://test.local/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("PATCH /api/admin/orders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const response = await patchOrder("order-1", { status: "delivered" });

    expect(response.status).toBe(401);
  });

  it("returns 403 when the caller is a client (not an admin-panel role)", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    store.seedProfile(
      buildProfileRow({
        id: "p-client",
        clerk_user_id: "user_client",
        email: "client@example.com",
        role: "client",
      }),
    );
    seedOrder();

    const response = await patchOrder("order-1", { status: "delivered" });

    expect(response.status).toBe(403);
  });

  it("persists status + paymentStatus + internalNotes to the DB row", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    seedAdmin();
    seedOrder();

    const response = await patchOrder("order-1", {
      status: "delivered",
      paymentStatus: "paid",
      internalNotes: "Livrat manual.",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.order.status).toBe("delivered");
    expect(body.order.payment.status).toBe("paid");

    const order = store.orderRows.get("order-1");
    expect(order?.status).toBe("completed");
    expect(order?.payment_status).toBe("paid");
    expect(order?.notes).toBe("Livrat manual.");
  });

  it("returns 404 when the order does not exist", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    seedAdmin();

    const response = await patchOrder("order-missing", { status: "delivered" });

    expect(response.status).toBe(404);
  });

  it("returns 400 when the body has an unknown field (strict)", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    seedAdmin();
    seedOrder();

    const response = await patchOrder("order-1", { bogusField: "x" });

    expect(response.status).toBe(400);
  });

  it("returns the unchanged order when the patch is empty", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    seedAdmin();
    seedOrder();

    const response = await patchOrder("order-1", {});

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.order.id).toBe("order-1");
  });

  it("ignores `returned` status (no repo equivalent) without erroring", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_admin" });
    seedAdmin();
    seedOrder();

    const response = await patchOrder("order-1", { status: "returned" });

    expect(response.status).toBe(200);
  });
});

describe("PATCH /api/admin/contact-messages/[id] — admin guard parity", () => {
  it("returns 401 when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const response = await patchContact(
      new Request("https://test.local/api/admin/contact-messages/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      }),
      { params: Promise.resolve({ id: "x" }) },
    );

    expect(response.status).toBe(401);
  });
});
