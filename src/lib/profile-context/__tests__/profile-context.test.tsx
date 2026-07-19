// @vitest-environment jsdom

import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  ProfileProvider,
  useCurrentProfile,
} from "@/lib/profile-context/profile-context";
import type { Profile } from "@/types/profile";

const clerkMock = vi.hoisted(() => ({
  useUser: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: clerkMock.useUser,
}));

const PROFILE: Profile = {
  id: "p-1",
  clerkUserId: "user_abc",
  email: "ana@example.com",
  fullName: "Ana",
  role: "client",
  notificationPreferences: { popup: true, email: true },
  createdAt: "2026-05-23T10:00:00Z",
  updatedAt: "2026-05-23T10:00:00Z",
};

function mockFetchOk(body: unknown): Mock {
  const mock = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function mockFetchError(status: number, body: unknown): Mock {
  const mock = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  clerkMock.useUser.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCurrentProfile (without provider)", () => {
  it("throws when called outside <ProfileProvider>", () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => renderHook(() => useCurrentProfile())).toThrow(
      /must be used within <ProfileProvider>/,
    );
    errorSpy.mockRestore();
  });
});

describe("ProfileProvider", () => {
  it("stays in 'idle' while Clerk has not finished loading", () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      user: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    expect(result.current.state.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flips to 'unauthenticated' once Clerk loads with no signed-in user", async () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("syncs and resolves to 'authenticated' when Clerk has a signed-in user", async () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: "user_abc" },
    });
    const fetchMock = mockFetchOk({ profile: PROFILE });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    await waitFor(() =>
      expect(result.current.state.status).toBe("authenticated"),
    );
    if (result.current.state.status === "authenticated") {
      expect(result.current.state.profile).toEqual(PROFILE);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sync-profile",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces server errors as 'error' state with the server-provided message", async () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: "user_x" },
    });
    mockFetchError(401, { error: "unauthenticated" });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status === "error") {
      expect(result.current.state.error).toBe("unauthenticated");
    }
  });

  it("calls refresh() to re-run the sync on demand", async () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: "user_abc" },
    });
    const fetchMock = mockFetchOk({ profile: PROFILE });

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    await waitFor(() =>
      expect(result.current.state.status).toBe("authenticated"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 'error: invalid_response' when the server responds 200 with no profile field", async () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: "user_abc" },
    });
    mockFetchOk({});

    const { result } = renderHook(() => useCurrentProfile(), {
      wrapper: ProfileProvider,
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status === "error") {
      expect(result.current.state.error).toBe("invalid_response");
    }
  });

  it("renders children inside the provider", () => {
    clerkMock.useUser.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      user: null,
    });

    render(
      <ProfileProvider>
        <p>hello</p>
      </ProfileProvider>,
    );

    expect(screen.getByText("hello")).toBeTruthy();
  });
});
