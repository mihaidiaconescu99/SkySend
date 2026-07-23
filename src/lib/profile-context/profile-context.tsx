"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";

import type { Profile } from "@/types/profile";

export type ProfileState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "authenticated"; profile: Profile }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export interface ProfileContextValue {
  state: ProfileState;

  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState<ProfileState>({ status: "idle" });

  const sync = useCallback(async () => {
    if (!isSignedIn) {
      setState({ status: "unauthenticated" });
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch("/api/auth/sync-profile", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorMessage =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : `HTTP ${response.status}`;
        setState({ status: "error", error: errorMessage });
        return;
      }

      const body = (await response.json()) as { profile?: Profile };
      if (!body.profile) {
        setState({ status: "error", error: "invalid_response" });
        return;
      }

      setState({ status: "authenticated", profile: body.profile });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown_error";
      setState({ status: "error", error: message });
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    void Promise.resolve().then(() => sync());
  }, [isLoaded, isSignedIn, user?.id, sync]);

  return (
    <ProfileContext.Provider value={{ state, refresh: sync }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useCurrentProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error(
      "useCurrentProfile must be used within <ProfileProvider>.",
    );
  }
  return ctx;
}

export function useOptionalCurrentProfile(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
