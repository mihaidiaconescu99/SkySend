import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: null as string | null,
  role: null as "client" | "operator" | "admin" | null,
}));

const supportMock = vi.hoisted(() => ({
  getSupportIdentity: vi.fn(),
  getTicketCounts: vi.fn(),
  listTickets: vi.fn(),
}));

vi.mock("@/lib/server-authorization", () => ({
  authorizeServerRoles: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!state.userId) {
      return {
        ok: false,
        status: 401,
        error: "Authentication required.",
      };
    }
    if (!state.role || !allowedRoles.includes(state.role)) {
      return {
        ok: false,
        status: 403,
        error: "Insufficient permissions.",
      };
    }
    return {
      ok: true,
      context: {
        userId: state.userId,
        role: state.role,
        resolution: "resolved",
      },
    };
  }),
}));

vi.mock("@/lib/support/support-hub", () => supportMock);

const { GET } = await import("@/app/api/operator/support/tickets/route");

beforeEach(() => {
  state.userId = null;
  state.role = null;
  supportMock.getSupportIdentity.mockReset();
  supportMock.getTicketCounts.mockReset();
  supportMock.listTickets.mockReset();
  supportMock.getSupportIdentity.mockImplementation(async (userId: string) => ({
    clerkUserId: userId,
    profileId: `profile_${userId}`,
    role: state.role,
  }));
  supportMock.getTicketCounts.mockResolvedValue({ unassigned: 0 });
  supportMock.listTickets.mockResolvedValue([]);
});

describe("GET /api/operator/support/tickets", () => {
  it("returns 401 for an unauthenticated direct request", async () => {
    const response = await GET(
      new Request("https://test.local/api/operator/support/tickets"),
    );

    expect(response.status).toBe(401);
    expect(supportMock.listTickets).not.toHaveBeenCalled();
  });

  it("returns 403 for a Client direct request", async () => {
    state.userId = "user_client";
    state.role = "client";

    const response = await GET(
      new Request("https://test.local/api/operator/support/tickets"),
    );

    expect(response.status).toBe(403);
    expect(supportMock.listTickets).not.toHaveBeenCalled();
  });

  it.each(["operator", "admin"] as const)(
    "allows %s to use the operator endpoint",
    async (role) => {
      state.userId = `user_${role}`;
      state.role = role;

      const response = await GET(
        new Request("https://test.local/api/operator/support/tickets"),
      );

      expect(response.status).toBe(200);
      expect(supportMock.listTickets).toHaveBeenCalledTimes(1);
    },
  );
});
