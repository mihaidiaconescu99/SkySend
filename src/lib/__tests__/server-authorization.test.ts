import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationMembershipList: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: clerkMock.auth,
  clerkClient: vi.fn(async () => ({
    organizations: {
      getOrganizationMembershipList:
        clerkMock.getOrganizationMembershipList,
    },
  })),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const {
  evaluateAuthorization,
  getServerAuthorizationContext,
  roleFromInternalMembership,
} = await import("@/lib/server-authorization");
const { canAccessRoleRoute } = await import("@/lib/auth");

function membership(userId: string, role: string) {
  return {
    role,
    organization: { id: "org_skysend" },
    publicUserData: { userId },
  };
}

function deniedStatus(
  decision: ReturnType<typeof evaluateAuthorization>,
) {
  if (decision.ok) throw new Error("Expected authorization to be denied.");
  return decision.status;
}

beforeEach(() => {
  process.env.CLERK_INTERNAL_ORGANIZATION_ID = "org_skysend";
  clerkMock.auth.mockReset();
  clerkMock.getOrganizationMembershipList.mockReset();
  clerkMock.getOrganizationMembershipList.mockResolvedValue({
    data: [],
    totalCount: 0,
  });
});

describe("Clerk organization role resolution", () => {
  it("maps only the two accepted SkySend membership roles", () => {
    expect(roleFromInternalMembership(null, false)).toBe("client");
    expect(roleFromInternalMembership("org:member", true)).toBe("operator");
    expect(roleFromInternalMembership("org:admin", true)).toBe("admin");
    expect(roleFromInternalMembership("org:custom", true)).toBeNull();
  });

  it("treats an expired or absent session as unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: null,
      sessionId: null,
      orgId: null,
      orgRole: null,
    });

    const context = await getServerAuthorizationContext();

    expect(context.userId).toBeNull();
    expect(deniedStatus(evaluateAuthorization(context, ["client"]))).toBe(401);
    expect(
      clerkMock.getOrganizationMembershipList,
    ).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when Clerk cannot resolve the session", async () => {
    clerkMock.auth.mockRejectedValue(new Error("Clerk unavailable"));

    const context = await getServerAuthorizationContext();

    expect(context.resolution).toBe("unavailable");
    expect(deniedStatus(evaluateAuthorization(context, ["client"]))).toBe(503);
    expect(
      clerkMock.getOrganizationMembershipList,
    ).not.toHaveBeenCalled();
  });

  it("resolves an authenticated non-member as Client", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_client",
      sessionId: "sess_client",
      orgId: null,
      orgRole: null,
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBe("client");
    expect(context.needsOrganizationActivation).toBe(false);
  });

  it("ignores membership in another active organization", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_other_org",
      sessionId: "sess_other",
      orgId: "org_other",
      orgRole: "org:admin",
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBe("client");
    expect(
      clerkMock.getOrganizationMembershipList,
    ).toHaveBeenCalledWith({
      organizationId: "org_skysend",
      userId: ["user_other_org"],
      limit: 1,
    });
  });

  it("resolves an inactive SkySend member and requests activation", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_operator",
      sessionId: "sess_operator",
      orgId: null,
      orgRole: null,
    });
    clerkMock.getOrganizationMembershipList.mockResolvedValue({
      data: [membership("user_operator", "org:member")],
      totalCount: 1,
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBe("operator");
    expect(context.needsOrganizationActivation).toBe(true);
  });

  it("uses validated active-organization claims without a backend lookup", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_admin",
      sessionId: "sess_admin",
      orgId: "org_skysend",
      orgRole: "org:admin",
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBe("admin");
    expect(context.needsOrganizationActivation).toBe(false);
    expect(
      clerkMock.getOrganizationMembershipList,
    ).not.toHaveBeenCalled();
  });

  it("looks up membership when the active organization claim has no role", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_operator",
      sessionId: "sess_operator",
      orgId: "org_skysend",
      orgRole: null,
    });
    clerkMock.getOrganizationMembershipList.mockResolvedValue({
      data: [membership("user_operator", "org:member")],
      totalCount: 1,
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBe("operator");
    expect(context.resolution).toBe("resolved");
    expect(
      clerkMock.getOrganizationMembershipList,
    ).toHaveBeenCalledTimes(1);
  });

  it("fails closed for an unsupported role in the internal organization", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_custom",
      sessionId: "sess_custom",
      orgId: "org_skysend",
      orgRole: "org:custom",
    });

    const context = await getServerAuthorizationContext();

    expect(context.role).toBeNull();
    expect(context.resolution).toBe("invalid_membership_role");
    expect(deniedStatus(evaluateAuthorization(context, ["client"]))).toBe(403);
  });

  it("fails closed when the internal organization is not configured", async () => {
    delete process.env.CLERK_INTERNAL_ORGANIZATION_ID;
    clerkMock.auth.mockResolvedValue({
      userId: "user_any",
      sessionId: "sess_any",
    });

    const context = await getServerAuthorizationContext();

    expect(context.resolution).toBe("not_configured");
    expect(deniedStatus(evaluateAuthorization(context, ["client"]))).toBe(503);
  });

  it("fails closed when Clerk membership lookup is unavailable", async () => {
    clerkMock.auth.mockResolvedValue({
      userId: "user_any",
      sessionId: "sess_any",
      orgId: null,
      orgRole: null,
    });
    clerkMock.getOrganizationMembershipList.mockRejectedValue(
      new Error("Clerk unavailable"),
    );

    const context = await getServerAuthorizationContext();

    expect(context.resolution).toBe("unavailable");
    expect(deniedStatus(evaluateAuthorization(context, ["client"]))).toBe(503);
  });

  it("reflects a Clerk role change after a new session", async () => {
    clerkMock.auth
      .mockResolvedValueOnce({
        userId: "user_staff",
        sessionId: "sess_before",
        orgId: "org_skysend",
        orgRole: "org:member",
      })
      .mockResolvedValueOnce({
        userId: "user_staff",
        sessionId: "sess_after",
        orgId: "org_skysend",
        orgRole: "org:admin",
      });

    expect((await getServerAuthorizationContext()).role).toBe("operator");
    expect((await getServerAuthorizationContext()).role).toBe("admin");
  });
});

describe("workspace and API authorization matrix", () => {
  it("keeps Client and Operator isolated and allows Admin in Operator tools", () => {
    expect(canAccessRoleRoute("client", "client")).toBe(true);
    expect(canAccessRoleRoute("client", "operator")).toBe(false);
    expect(canAccessRoleRoute("client", "admin")).toBe(false);
    expect(canAccessRoleRoute("operator", "operator")).toBe(true);
    expect(canAccessRoleRoute("operator", "client")).toBe(false);
    expect(canAccessRoleRoute("operator", "admin")).toBe(false);
    expect(canAccessRoleRoute("admin", "admin")).toBe(true);
    expect(canAccessRoleRoute("admin", "operator")).toBe(true);
    expect(canAccessRoleRoute("admin", "client")).toBe(false);
  });

  it("returns 403 for direct API access with the wrong role", () => {
    const clientContext = {
      userId: "user_client",
      sessionId: "sess_client",
      role: "client" as const,
      internalOrganizationId: "org_skysend",
      internalMembershipRole: null,
      activeOrganizationId: null,
      activeOrganizationRole: null,
      needsOrganizationActivation: false,
      resolution: "resolved" as const,
    };
    const operatorContext = {
      ...clientContext,
      userId: "user_operator",
      role: "operator" as const,
      internalMembershipRole: "org:member",
    };

    expect(
      deniedStatus(
        evaluateAuthorization(clientContext, ["operator", "admin"]),
      ),
    ).toBe(403);
    expect(
      deniedStatus(evaluateAuthorization(clientContext, ["admin"])),
    ).toBe(403);
    expect(
      deniedStatus(evaluateAuthorization(operatorContext, ["admin"])),
    ).toBe(403);
    expect(
      evaluateAuthorization(operatorContext, ["operator", "admin"]).ok,
    ).toBe(true);
    expect(
      evaluateAuthorization(
        {
          ...clientContext,
          userId: "user_admin",
          role: "admin",
          internalMembershipRole: "org:admin",
        },
        ["operator", "admin"],
      ).ok,
    ).toBe(true);
  });
});
