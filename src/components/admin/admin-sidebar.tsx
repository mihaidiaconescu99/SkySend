"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { adminNavigationItems } from "@/constants/admin-navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  currentPath: string;
  canManageStaffAccess: boolean;
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

export function AdminSidebar({ currentPath, canManageStaffAccess, onNavigate }: AdminSidebarProps) {
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

        <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/70 bg-card/60 p-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Administrare
          </p>
          <p className="mt-1.5 font-heading text-lg tracking-tight text-foreground">
            Panou Administrator
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Spațiu intern pentru operațiunile SkySend.
          </p>
        </div>

        <nav aria-label="Navigație administrator" className="grid gap-1.5">
          {adminNavigationItems.filter((item) => item.key !== "access" || canManageStaffAccess).map((item) => {
            const Icon = item.icon;
            const isActive = isActiveAdminItem(currentPath, item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "group rounded-[calc(var(--radius)+0.25rem)] border px-3 py-2.5 transition-colors",
                  isActive
                    ? "border-primary/45 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-5">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-1.5">
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

        <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/70 bg-secondary/35 p-2.5">
          <Link
            href="/"
            onClick={onNavigate}
            className="inline-flex min-h-9 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Înapoi la site
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
