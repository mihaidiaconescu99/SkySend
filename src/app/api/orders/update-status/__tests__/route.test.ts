import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_client" })),
}));

const { POST } = await import("@/app/api/orders/update-status/route");

describe("POST /api/orders/update-status", () => {
  it("does not accept client-driven fulfillment transitions", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          orderId: "SKY-PT-12345-123",
          fulfillmentStatus: "completed_mission",
          paymentStatus: "paid",
        }),
      }),
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "server_managed_order_status",
    });
  });
});
