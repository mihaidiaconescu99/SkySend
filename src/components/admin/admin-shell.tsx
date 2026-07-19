"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { getAdminNavigationItem } from "@/constants/admin-navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AdminShell({ children, canManageStaffAccess }: { children: ReactNode; canManageStaffAccess: boolean }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeItem = getAdminNavigationItem(pathname);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-background text-foreground lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(32,231,213,0.08),transparent_24rem),linear-gradient(180deg,rgba(7,16,23,0.96)_0%,rgba(5,7,10,1)_28rem)]" />

      <div className="grid min-h-screen min-w-0 lg:h-full lg:min-h-0 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <div className="hidden min-h-screen lg:block lg:h-dvh lg:min-h-0">
          <div className="h-full">
            <AdminSidebar currentPath={pathname} canManageStaffAccess={canManageStaffAccess} />
          </div>
        </div>

        <div className="min-w-0 lg:h-dvh lg:min-h-0 lg:overflow-y-auto">
          <AdminTopbar
            activeItem={activeItem}
            onOpenMenu={() => setIsMenuOpen(true)}
          />
          <main id="main-content" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!isMenuOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/62 backdrop-blur-sm transition-opacity",
            isMenuOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[min(21rem,calc(100vw-3rem))] bg-sidebar shadow-[var(--elevation-panel)] transition-transform",
            isMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground"
            aria-label="Închide meniul de administrare"
          >
            <X className="size-5" />
          </button>
          <AdminSidebar
            currentPath={pathname}
            canManageStaffAccess={canManageStaffAccess}
            onNavigate={() => setIsMenuOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
