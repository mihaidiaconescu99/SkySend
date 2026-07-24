import { describe, expect, it, vi } from "vitest";

const ownershipMock = vi.hoisted(() => ({
  stripeRefund: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_owner" })),
}));

vi.mock("@/lib/api/role-guard", () => ({
  authorizeApiRequest: vi.fn(async () => ({
    ok: true,
    context: { userId: "user_owner", role: "client" },
  })),
}));

vi.mock("@/lib/repositories/profiles-repository", () => ({
  ProfilesRepository: class {
    async getByClerkUserId() {
      return {
        ok: true,
        data: { id: "11111111-1111-1111-1111-111111111111" },
      };
    }
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeServer: () => ({
    refunds: { create: ownershipMock.stripeRefund },
  }),
}));

const { POST } = await import(
  "@/app/api/client/orders/[orderId]/cancel-before-dispatch/route"
);

describe("POST /api/client/orders/:orderId/cancel-before-dispatch", () => {
  it("returns 404 without a Stripe effect for a foreign order identifier", async () => {
    const response = await POST(
      new Request(
        "http://localhost:3000/api/client/orders/SKY-PT-99999-999/cancel-before-dispatch",
        {
          method: "POST",
          headers: { Origin: "http://localhost:3000" },
        },
      ),
      { params: Promise.resolve({ orderId: "SKY-PT-99999-999" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "order_not_found" });
    expect(ownershipMock.stripeRefund).not.toHaveBeenCalled();
  });
});
