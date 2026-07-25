"use client";

import Link from "next/link";
import { ShieldCheck, UserRound, Wrench } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { adminNavigationItems } from "@/constants/admin-navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  currentPath: string;
  animationScope: "desktop" | "mobile";
  onNavigate?: () => void;
};

function isActiveAdminItem(currentPath: string, href: string) {
  if (href === "/admin") {
    return currentPath === "/admin";
  }

  if (
    href === "/admin/failed-orders" &&
    currentPath.startsWith("/admin/locker-recoveries")
  ) {
    return true;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AdminSidebar({
  currentPath,
  animationScope,
  onNavigate,
}: AdminSidebarProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const workspaces = [
    { label: "Spațiu admin", href: "/admin", icon: ShieldCheck },
    { label: "Spațiu operator", href: "/operator", icon: Wrench },
    { label: "Spațiu client", href: "/client", icon: UserRound },
  ] as const;
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border/70 bg-sidebar/95">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        <Link
          href="/"
          aria-label="Pagina publică SkySend"
          className="mx-1 w-fit rounded-xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-ring"
          onClick={onNavigate}
        >
          <BrandMark compact />
        </Link>

        <nav aria-label="Navigație administrator" className="grid gap-1.5">
          {adminNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveAdminItem(currentPath, item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "group rounded-xl border px-3 py-2.5 transition-colors",
                  isActive
                    ? "border-transparent text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "relative flex size-8 shrink-0 items-center justify-center rounded-full",
                      isActive
                        ? "text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId={`admin-active-icon-${animationScope}`}
                        className="absolute inset-0 rounded-full bg-primary"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 520, damping: 42 }
                        }
                      />
                    ) : null}
                    <Icon className="relative z-10 size-4" />
                  </span>
                  <span className="truncate text-sm font-medium leading-5">
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sticky bottom-0 z-10 mt-auto grid gap-1.5 border-t border-border/70 bg-sidebar/95 pb-1 pt-3 backdrop-blur">
          <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Spații de lucru</p>
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            const active = currentPath.startsWith(workspace.href);
            return (
              <Link key={workspace.href} href={workspace.href} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", active ? "bg-card text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                <Icon className="size-4" />{workspace.label}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
