"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { roleRoutingPaths } from "@/constants/roles";
import { getRoleFromClerkMetadata } from "@/lib/auth";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { Button } from "@/components/ui/button";
import type { ClerkRoleMetadata, UserRole } from "@/types/roles";

type ClerkAuthControlsProps = {
  mobile?: boolean;
  onAction?: () => void;
};

const clerkEnabled = isClerkFrontendConfigured();

function getAccountSettingsUrl(role: UserRole | null | undefined) {
  switch (role) {
    case "admin":
      return "/admin/settings";
    case "operator":
      return "/operator";
    case "client":
    default:
      return "/client/settings";
  }
}

export function ClerkAuthControls({
  mobile = false,
  onAction,
}: ClerkAuthControlsProps) {
  if (!clerkEnabled) {
    return null;
  }

  return <ClerkAuthControlsInner mobile={mobile} onAction={onAction} />;
}

function ClerkAuthControlsInner({
  mobile,
  onAction,
}: {
  mobile: boolean;
  onAction?: () => void;
}) {
  const { user } = useUser();
  const role =
    getRoleFromClerkMetadata(
      (user?.publicMetadata ?? null) as ClerkRoleMetadata | null,
    ) ?? "client";
  const accountSettingsUrl = getAccountSettingsUrl(role);

  return (
    <>
      <Show when="signed-out">
        <div className={mobile ? "flex w-full flex-col gap-2" : "flex items-center gap-2"}>
          <SignInButton mode="redirect" forceRedirectUrl={roleRoutingPaths.authContinue}>
            <Button
              variant="ghost"
              size={mobile ? "default" : "sm"}
              className={mobile ? "w-full justify-center" : undefined}
              onClick={onAction}
            >
              Autentificare
            </Button>
          </SignInButton>

          <SignUpButton mode="redirect" forceRedirectUrl={roleRoutingPaths.authContinue}>
            <Button
              variant="outline"
              size={mobile ? "default" : "sm"}
              className={mobile ? "w-full justify-center" : undefined}
              onClick={onAction}
            >
              Creează cont
            </Button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className={mobile ? "flex w-full justify-center" : "flex items-center"}>
          <UserButton
            showName={!mobile}
            afterSwitchSessionUrl={roleRoutingPaths.authContinue}
            userProfileMode="navigation"
            userProfileUrl={accountSettingsUrl}
          />
        </div>
      </Show>
    </>
  );
}
