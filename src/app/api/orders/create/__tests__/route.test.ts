import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOrderRow,
  buildPaymentRecordRow,
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

const adminMock = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: adminMock.createAdminSupabaseClient,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("@/app/api/orders/create/route");

let store: FakeStore;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  adminMock.createAdminSupabaseClient.mockReturnValue(fake.client);
});

afterEach(() => {
  vi.clearAllMocks();
});

function seedProfile(clerkUserId: string, profileId: string) {
  store.seedProfile(
    buildProfileRow({
      id: profileId,
      clerk_user_id: clerkUserId,
      email: "client@example.com",
    }),
  );
}

function postJson(body: unknown) {
  return POST(
    new Request("https://test.local/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/orders/create — idempotency on localOrderId", () => {
  it("returns 401 when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });

    const response = await postJson({ localOrderId: "SKY-PT-1" });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the profile is missing", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_orphan" });

    const response = await postJson({
      payload: {},
      localOrderId: "SKY-PT-1",
      publicTrackingCode: "TRK-MISSING",
      recipientTrackingToken: "TKN-MISSING",
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 when the body is invalid", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    seedProfile("user_client", "p-1");

    const response = await postJson({});

    expect(response.status).toBe(400);
  });

  it("returns an existing order without accepting client payment authority", async () => {

    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const profileId = "p-1";
    seedProfile("user_client", profileId);

    store.seedOrder(
      buildOrderRow({
        id: "order-existing",
        local_order_id: "SKY-PT-DUP-1",
        sender_profile_id: profileId,
        payment_status: "pending",
        total_amount_minor: 2310,
      }),
    );

    const response = await postJson({
      payload: {},
      localOrderId: "SKY-PT-DUP-1",
      publicTrackingCode: "TRK-PUB",
      recipientTrackingToken: "TKN-REC",
      paymentStatus: "paid",
      stripePaymentIntentId: "pi_test_123",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.supabaseOrderId).toBe("order-existing");
    expect(body.localOrderId).toBe("SKY-PT-DUP-1");

    expect(store.orderRows.size).toBe(1);
    const order = [...store.orderRows.values()][0];
    expect(order.id).toBe("order-existing");
    expect(order.payment_status).toBe("pending");
    expect(order.stripe_payment_intent_id).toBeNull();
    expect(store.paymentRecordRows.size).toBe(0);
  });

  it("does not duplicate the payment_records row on a repeat paid request", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const profileId = "p-1";
    seedProfile("user_client", profileId);

    store.seedOrder(
      buildOrderRow({
        id: "order-existing",
        local_order_id: "SKY-PT-DUP-2",
        sender_profile_id: profileId,
        payment_status: "paid",
        total_amount_minor: 2310,
        stripe_payment_intent_id: "pi_repeat",
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "pay-1",
        order_id: "order-existing",
        profile_id: profileId,
        stripe_payment_intent_id: "pi_repeat",
        amount_minor: 2310,
        status: "succeeded",
        type: "payment",
      }),
    );

    const response = await postJson({
      payload: {},
      localOrderId: "SKY-PT-DUP-2",
      publicTrackingCode: "TRK-PUB",
      recipientTrackingToken: "TKN-REC",
      paymentStatus: "paid",
      stripePaymentIntentId: "pi_repeat",
    });

    expect(response.status).toBe(200);
    expect(store.paymentRecordRows.size).toBe(1);
  });

  it("returns 409 when the localOrderId already belongs to another profile", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    seedProfile("user_client", "p-1");

    store.seedOrder(
      buildOrderRow({
        id: "order-other",
        local_order_id: "SKY-PT-OTHER",
        sender_profile_id: "p-someone-else",
      }),
    );

    const response = await postJson({
      payload: {},
      localOrderId: "SKY-PT-OTHER",
      publicTrackingCode: "TRK-PUB",
      recipientTrackingToken: "TKN-REC",
    });

    expect(response.status).toBe(409);
    expect(store.orderRows.size).toBe(1);
  });

  it("does not create a payment_records row when the request is unpaid", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const profileId = "p-1";
    seedProfile("user_client", profileId);

    store.seedOrder(
      buildOrderRow({
        id: "order-existing",
        local_order_id: "SKY-PT-UNPAID",
        sender_profile_id: profileId,
        payment_status: "pending",
      }),
    );

    const response = await postJson({
      payload: {},
      localOrderId: "SKY-PT-UNPAID",
      publicTrackingCode: "TRK-PUB",
      recipientTrackingToken: "TKN-REC",
      paymentStatus: "pending",
    });

    expect(response.status).toBe(200);
    expect(store.paymentRecordRows.size).toBe(0);
  });
});
