"use client";

import Link from "next/link";
import { getDashboardNavigation } from "@/constants/navigation";
import { useCurrentRoute } from "@/hooks/use-current-route";
import type { DashboardNavItem } from "@/types/navigation";
import type { DashboardRole } from "@/types/roles";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";

function SidebarGroup({
  title,
  items,
  currentRoute,
}: {
  title: string;
  items: readonly DashboardNavItem[];
  currentRoute: string;
}) {
  return (
    <section
      className="min-w-0 space-y-2.5"
      aria-labelledby={`sidebar-group-${title.toLowerCase()}`}
    >
      <p
        id={`sidebar-group-${title.toLowerCase()}`}
        className="px-2 text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {title}
      </p>
      <nav className="grid gap-2" aria-label={title}>
        {items.map((item) => {
          const Icon = item.icon;
          const itemBasePath = item.href.split("#")[0];
          const isOverviewRoot =
            item.href.endsWith("#overview") &&
            currentRoute === item.href.split("#")[0];
          const isNestedActive =
            itemBasePath !== "/client" &&
            itemBasePath !== "/admin" &&
            itemBasePath !== "/operator" &&
            currentRoute.startsWith(`${itemBasePath}/`);
          const isActive =
            currentRoute === item.href ||
            isOverviewRoot ||
            (itemBasePath === currentRoute && !item.href.includes("#")) ||
            isNestedActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "block min-w-0 rounded-[calc(var(--radius)+0.35rem)] border px-3.5 py-3 transition-colors",
                isActive
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground",
                  )}
                >
                  <Icon className="size-[1.08rem]" />
                </span>
                <span className="block min-w-0">
                  <span className="block text-[0.98rem] font-medium leading-tight">
                    {item.label}
                  </span>
                  <small className="mt-1 block text-[0.82rem] leading-5 text-muted-foreground">
                    {item.description}
                  </small>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export function DashboardSidebar({ role }: { role: DashboardRole }) {
  const navigation = getDashboardNavigation(role);
  const currentRoute = useCurrentRoute();
  const isClientWorkspace = role === "client";

  return (
    <aside
      className={cn(
        "hidden h-dvh min-h-0 overflow-y-auto border-r border-border/80 bg-sidebar/95",
        isClientWorkspace ? "expanded-ui:block" : "lg:block",
      )}
    >
      <div className="flex min-h-full min-w-0 flex-col gap-7 px-5 py-7">
        <Link
          href="/"
          aria-label="Pagina publică SkySend"
          className="mx-2 rounded-2xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-ring"
        >
          <BrandMark compact />
        </Link>

        <SidebarGroup
          title="Navigație"
          items={navigation.primary}
          currentRoute={currentRoute}
        />

        <SidebarGroup
          title="Cont"
          items={navigation.secondary}
          currentRoute={currentRoute}
        />

        {!isClientWorkspace ? (
          <div className="mt-auto space-y-2">
            <p className="px-2 text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Spații de lucru
            </p>
            <nav className="grid gap-2">
              {navigation.workspaces.map((item) => {
                const Icon = item.icon;
                const isActive = currentRoute.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-[calc(var(--radius)+0.35rem)] px-3.5 py-3.5 transition-colors",
                      isActive
                        ? "bg-card text-foreground shadow-[var(--elevation-card)]"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-3.5">
                      <Icon className="size-[1.08rem]" />
                      <span className="text-[0.98rem]">{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
