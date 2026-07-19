"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, SignOutButton, useUser } from "@clerk/nextjs";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, Languages, LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleRoutingPaths } from "@/constants/roles";
import { getRoleFromClerkMetadata } from "@/lib/auth";
import { isClerkFrontendConfigured } from "@/lib/clerk-config";
import { useSettings } from "@/lib/settings/settings-context";
import { PreferencesControls } from "@/components/shared/preferences/preferences-controls";
import { cn } from "@/lib/utils";
import type { ClerkRoleMetadata, UserRole } from "@/types/roles";

type HeaderAccountProps = {
  mobile?: boolean;
  onAction?: () => void;
};

const clerkEnabled = isClerkFrontendConfigured();

function accountSettingsUrl(role: UserRole | null | undefined) {
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

export function HeaderAccount({ mobile = false, onAction }: HeaderAccountProps) {
  if (!clerkEnabled) {
    return <PreferencesOnlyButton mobile={mobile} onAction={onAction} />;
  }
  return <HeaderAccountInner mobile={mobile} onAction={onAction} />;
}

function HeaderAccountInner({ mobile = false, onAction }: HeaderAccountProps) {
  const { user, isLoaded, isSignedIn } = useUser();

  const role =
    getRoleFromClerkMetadata(
      (user?.publicMetadata ?? null) as ClerkRoleMetadata | null,
    ) ?? "client";

  if (!isLoaded) {
    return <span aria-hidden="true" className="size-9" />;
  }

  if (!isSignedIn || !user) {
    return <SignedOutControls mobile={mobile} onAction={onAction} />;
  }

  return <SignedInMenu mobile={mobile} onAction={onAction} role={role} />;
}

function SignedOutControls({
  mobile = false,
  onAction,
}: HeaderAccountProps) {
  const { t } = useSettings();

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        mobile && "flex-col items-stretch",
      )}
    >
      <SignInButton mode="redirect" forceRedirectUrl={roleRoutingPaths.authContinue}>
        <Button
          variant="ghost"
          size={mobile ? "default" : "sm"}
          className={mobile ? "w-full justify-center" : undefined}
          onClick={onAction}
        >
          {t("auth.signIn")}
        </Button>
      </SignInButton>
      <SignUpButton mode="redirect" forceRedirectUrl={roleRoutingPaths.authContinue}>
        <Button
          variant="outline"
          size={mobile ? "default" : "sm"}
          className={mobile ? "w-full justify-center" : undefined}
          onClick={onAction}
        >
          {t("auth.signUp")}
        </Button>
      </SignUpButton>
      <PreferencesMenuTrigger
        mobile={mobile}
        onAction={onAction}
        signedOutLanguageOnly
      />
    </div>
  );
}

function SignedInMenu({
  mobile = false,
  onAction,
  role,
}: HeaderAccountProps & { role: UserRole }) {
  const { user } = useUser();
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const displayName = useMemo(
    () => user?.fullName || user?.firstName || user?.username || "",
    [user?.fullName, user?.firstName, user?.username],
  );
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  useEffect(() => {
    if (!open || mobile) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, mobile]);

  const isMobileMode = mobile;

  if (isMobileMode) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between rounded-2xl border border-border/65 bg-card/65 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar />
            <div className="grid min-w-0">
              {displayName ? (
                <span className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </span>
              ) : (
                <span className="grid h-5 w-24 place-items-center text-xs text-muted-foreground">
                  {t("auth.guest")}
                </span>
              )}
              {email ? (
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((v) => !v)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-300",
                mobileExpanded && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </div>
        <AnimatePresence>
          {mobileExpanded ? (
            <m.div
              key="mobile-account-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="grid gap-2 rounded-2xl border border-border/65 bg-background/80 p-3">
                <MenuLink
                  href={accountSettingsUrl(role)}
                  icon={<SettingsIcon className="size-4" />}
                  label={t("auth.accountSettings")}
                  onClick={() => {
                    setMobileExpanded(false);
                    onAction?.();
                  }}
                />
                <SignOutButton redirectUrl="/">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setMobileExpanded(false);
                      onAction?.();
                    }}
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t("auth.signOut")}
                  </Button>
                </SignOutButton>
                <div className="h-px bg-border" />
                <PreferencesControls showTheme={false} />
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border/65 bg-background/65 px-1.5 py-1 pr-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-background"
      >
        <UserAvatar />
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            key="signed-in-menu"
            id={menuId}
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(20rem,calc(100vw-1.5rem))] gap-3 overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-background/96 p-3 shadow-[var(--elevation-panel)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border/65 bg-card/65 p-2.5">
              <UserAvatar />
              <div className="grid min-w-0">
                {displayName ? (
                  <span className="truncate text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("auth.guest")}
                  </span>
                )}
                {email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
              </div>
            </div>

            <MenuLink
              href={accountSettingsUrl(role)}
              icon={<SettingsIcon className="size-4" />}
              label={t("auth.accountSettings")}
              onClick={() => setOpen(false)}
            />
            <SignOutButton redirectUrl="/">
              <button
                role="menuitem"
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {t("auth.signOut")}
              </button>
            </SignOutButton>

            <div className="h-px bg-border" />
            <PreferencesControls showTheme={false} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function UserAvatar() {
  const { user } = useUser();
  const initial =
    (user?.firstName ?? "")[0] || (user?.lastName ?? "")[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U";
  if (user?.imageUrl) {
    return (
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border/80 bg-secondary/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.imageUrl}
          alt=""
          className="size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full border border-border/80 bg-secondary/65 font-heading text-sm font-semibold text-foreground"
    >
      {initial.toUpperCase()}
    </span>
  );
}

function MenuLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
    >
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function PreferencesOnlyButton({
  mobile = false,
  onAction,
}: HeaderAccountProps) {
  return (
    <PreferencesMenuTrigger
      mobile={mobile}
      onAction={onAction}
      signedOutLanguageOnly
    />
  );
}

function PreferencesMenuTrigger({
  mobile = false,
  onAction,
  signedOutLanguageOnly = false,
}: HeaderAccountProps & { signedOutLanguageOnly?: boolean }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={cn("relative", mobile && "w-full")}>
      <Button
        type="button"
        variant="ghost"
        size={mobile ? "default" : "sm"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("auth.preferences")}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "gap-1.5",
          mobile ? "w-full justify-start" : "",
          signedOutLanguageOnly && !mobile ? "rounded-full px-2.5" : "",
        )}
      >
        {signedOutLanguageOnly ? (
          <Languages className="size-4" aria-hidden="true" />
        ) : (
          <UserRound className="size-4" aria-hidden="true" />
        )}
        {signedOutLanguageOnly && !mobile ? null : (
          <span>
            {signedOutLanguageOnly ? t("preferences.language") : t("auth.preferences")}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 opacity-70 transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </Button>
      <AnimatePresence>
        {open ? (
          <m.div
            key="preferences-menu"
            id={menuId}
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "z-50 grid gap-3 overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-background/96 p-3 shadow-[var(--elevation-panel)] backdrop-blur-xl",
              mobile
                ? "mt-2 w-full"
                : "absolute right-0 top-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-1.5rem))]",
            )}
          >
            {!signedOutLanguageOnly ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("auth.preferences")}
              </p>
            ) : null}
            <PreferencesControls
              showCurrency={!signedOutLanguageOnly}
              showTheme={false}
            />
            {onAction ? (
              <button
                type="button"
                onClick={() => {
                  onAction();
                  setOpen(false);
                }}
                className="text-[11px] text-muted-foreground/70 underline-offset-2 hover:underline"
              >
                ok
              </button>
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
