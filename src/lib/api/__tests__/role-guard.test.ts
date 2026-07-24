import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizationMock = vi.hoisted(() => ({
  authorizeServerRoles: vi.fn(),
}));

vi.mock("@/lib/server-authorization", () => ({
  authorizeServerRoles: authorizationMock.authorizeServerRoles,
}));

const { authorizeApiRequest } = await import("@/lib/api/role-guard");

beforeEach(() => {
  authorizationMock.authorizeServerRoles.mockReset();
});

describe("direct API role guard", () => {
  it.each([
    [401, "Authentication required."],
    [403, "Insufficient permissions."],
    [503, "Authorization service unavailable."],
  ] as const)("returns a controlled %i response", async (status, error) => {
    authorizationMock.authorizeServerRoles.mockResolvedValue({
      ok: false,
      status,
      error,
    });

    const result = await authorizeApiRequest(["admin"]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected the request to be denied.");
    expect(result.response.status).toBe(status);
    expect(await result.response.json()).toEqual({ error });
  });

  it("accepts Operator and Admin for operator endpoints", async () => {
    authorizationMock.authorizeServerRoles.mockResolvedValue({
      ok: true,
      context: {
        userId: "user_operator",
        role: "operator",
        resolution: "resolved",
      },
    });

    const result = await authorizeApiRequest(["operator", "admin"]);

    expect(result.ok).toBe(true);
    expect(authorizationMock.authorizeServerRoles).toHaveBeenCalledWith([
      "operator",
      "admin",
    ]);
  });

  it("requests only Admin for admin endpoints", async () => {
    authorizationMock.authorizeServerRoles.mockResolvedValue({
      ok: true,
      context: {
        userId: "user_admin",
        role: "admin",
        resolution: "resolved",
      },
    });

    const result = await authorizeApiRequest(["admin"]);

    expect(result.ok).toBe(true);
    expect(authorizationMock.authorizeServerRoles).toHaveBeenCalledWith([
      "admin",
    ]);
  });
});
