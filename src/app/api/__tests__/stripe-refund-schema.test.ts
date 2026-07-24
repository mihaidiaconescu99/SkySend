import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/stripe/server", () => ({ getStripeServer: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/repositories/orders-repository", () => ({
  OrdersRepository: vi.fn(),
}));
vi.mock("@/lib/repositories/payment-records-repository", () => ({
  PaymentRecordsRepository: vi.fn(),
}));
vi.mock("@/lib/repositories/profiles-repository", () => ({
  ProfilesRepository: vi.fn(),
}));

const { refundBodySchema } = await import("@/lib/stripe/input-schemas");

describe("stripe/refund POST schema", () => {
  it("accepts a valid request with an audit reason", () => {
    const result = refundBodySchema.safeParse({ orderId: "SKY-PT-12345-000", reason: "Cerere administrativă" });
    expect(result.success).toBe(true);
  });

  it("accepts a request with an optional reason", () => {
    const result = refundBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      reason: "Customer changed their mind",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a UUID-format orderId", () => {
    const result = refundBodySchema.safeParse({
      orderId: "00000000-0000-4000-8000-000000000001", reason: "Cerere administrativă",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing orderId", () => {
    const result = refundBodySchema.safeParse({ reason: "no orderId" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string orderId", () => {
    const result = refundBodySchema.safeParse({ orderId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a null orderId", () => {
    const result = refundBodySchema.safeParse({ orderId: null });
    expect(result.success).toBe(false);
  });

  it("rejects a numeric orderId", () => {
    const result = refundBodySchema.safeParse({ orderId: 12345 });
    expect(result.success).toBe(false);
  });
});
