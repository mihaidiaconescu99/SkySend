"use client";

import { useEffect, useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { getAdminOperationalSettings } from "@/lib/admin-settings";
import { cn } from "@/lib/utils";
import type { OperationalSettings } from "@/types/admin";
import type { AdminNavigationItem } from "@/types/admin-navigation";

type AdminTopbarProps = {
  activeItem: AdminNavigationItem;
  onOpenMenu: () => void;
};

function getPlatformDotClass(status: OperationalSettings["platformStatus"]) {
  switch (status) {
    case "active":
      return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]";
    case "maintenance":
      return "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.65)]";
  }
}

export function AdminTopbar({ activeItem, onOpenMenu }: AdminTopbarProps) {
  const [platformStatus, setPlatformStatus] = useState(() =>
    getAdminOperationalSettings(),
  );

  useEffect(() => {
    function refreshPlatformStatus() {
      setPlatformStatus(getAdminOperationalSettings());
    }

    const refreshFrame = window.requestAnimationFrame(() => {
      refreshPlatformStatus();
    });

    window.addEventListener("skysend:admin-settings-updated", refreshPlatformStatus);
    window.addEventListener("storage", refreshPlatformStatus);

    return () => {
      window.cancelAnimationFrame(refreshFrame);
      window.removeEventListener(
        "skysend:admin-settings-updated",
        refreshPlatformStatus,
      );
      window.removeEventListener("storage", refreshPlatformStatus);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border/75 bg-card/70 text-foreground transition-colors hover:border-primary/45 hover:bg-secondary lg:hidden"
            aria-label="Deschide meniul de administrare"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Spațiu operațional
            </p>
            <p className="mt-1 truncate font-heading text-xl tracking-tight text-foreground sm:text-2xl">
              {activeItem.label}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden min-h-10 items-center gap-2 rounded-full border border-border/70 bg-card/55 px-3 text-sm text-muted-foreground shadow-[var(--elevation-soft)] sm:inline-flex">
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", getPlatformDotClass(platformStatus.platformStatus))}
            />
            {platformStatus.platformStatusLabel}
          </span>
          <div className="inline-flex size-11 items-center justify-center rounded-full border border-border/70 bg-card/55 shadow-[var(--elevation-soft)]">
            <UserButton
              userProfileMode="navigation"
              userProfileUrl="/admin/settings"
              appearance={{
                elements: {
                  avatarBox: "size-9",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
