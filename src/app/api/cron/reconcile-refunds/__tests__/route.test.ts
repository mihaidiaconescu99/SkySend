import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cronMock = vi.hoisted(() => ({
  reconcilePendingRefunds: vi.fn(),
  adminClient: {},
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => cronMock.adminClient,
}));

vi.mock("@/lib/refund-reconciliation-server", () => ({
  reconcilePendingRefunds: cronMock.reconcilePendingRefunds,
}));

const { GET } = await import("@/app/api/cron/reconcile-refunds/route");

beforeEach(() => {
  process.env.CRON_SECRET = "cron-test-secret";
  cronMock.reconcilePendingRefunds.mockReset();
  cronMock.reconcilePendingRefunds.mockResolvedValue({ processed: 0 });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/reconcile-refunds", () => {
  it("does not run with an invalid secret", async () => {
    const response = await GET(
      new Request("https://app.skysend.test/api/cron/reconcile-refunds", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(cronMock.reconcilePendingRefunds).not.toHaveBeenCalled();
  });

  it("runs with the configured secret", async () => {
    const response = await GET(
      new Request("https://app.skysend.test/api/cron/reconcile-refunds", {
        headers: { Authorization: "Bearer cron-test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(cronMock.reconcilePendingRefunds).toHaveBeenCalledWith(
      cronMock.adminClient,
    );
  });
});
