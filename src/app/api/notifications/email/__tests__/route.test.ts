import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emailMock = vi.hoisted(() => ({
  sendSkySendEmail: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendSkySendEmail: emailMock.sendSkySendEmail,
}));

const { POST } = await import("@/app/api/notifications/email/route");

beforeEach(() => {
  process.env.INTERNAL_API_SECRET = "internal-test-secret";
  emailMock.sendSkySendEmail.mockReset();
});

afterEach(() => {
  delete process.env.INTERNAL_API_SECRET;
});

describe("POST /api/notifications/email", () => {
  it("refuses a direct client request without the internal Bearer secret", async () => {
    const response = await POST(
      new Request("https://app.skysend.test/api/notifications/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.skysend.test",
        },
        body: JSON.stringify({
          event: "recipient_tracking_link",
          to: "victim@example.com",
          orderId: "SKY-PT-12345-123",
          trackingUrl: "https://evil.example/collect",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(emailMock.sendSkySendEmail).not.toHaveBeenCalled();
  });
});
