"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { roleRoutingPaths } from "@/constants/roles";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-theme";
import { ProfileProvider } from "@/lib/profile-context/profile-context";
import { SettingsProvider } from "@/lib/settings/settings-context";
import { ToastProvider } from "@/components/shared/toast-provider";
import { SkySendAssistant } from "@/components/assistant/skysend-assistant";

export function Providers({ children }: { children: ReactNode }) {
  const clerkEnabled = isClerkFrontendConfigured();

  if (!clerkEnabled) {
    return (
      <SettingsProvider>
        {children}
        <ToastProvider />
        <SkySendAssistant />
      </SettingsProvider>
    );
  }

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl={roleRoutingPaths.authContinue}
      signUpFallbackRedirectUrl={roleRoutingPaths.authContinue}
    >
      <ProfileProvider>
        <SettingsProvider>
          {children}
          <ToastProvider />
          <SkySendAssistant />
        </SettingsProvider>
      </ProfileProvider>
    </ClerkProvider>
  );
}
