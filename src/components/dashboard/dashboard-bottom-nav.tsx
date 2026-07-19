"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPinned, Package, Plus, User } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useNotificări } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/client/create-delivery", icon: Plus, label: "Creează", accent: true, badge: false },
  { href: "/client/orders", icon: Package, label: "Comenzi", accent: false, badge: false },
  { href: "/client/saved-places", icon: MapPinned, label: "Salvate", accent: false, badge: false },
  { href: "/client/settings", icon: User, label: "Cont", accent: false, badge: false },
] as const;

export function DashboardBottomNav() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const { unreadCount } = useNotificări();

  return (
    <nav
      aria-label="Navigație mobilă"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] border-t border-white/8 bg-background/94 shadow-[0_-18px_42px_-28px_rgba(0,0,0,0.92)] backdrop-blur-2xl" />
      <div className="mx-auto grid h-[var(--bottom-nav-height)] w-full max-w-[30rem] grid-cols-4 items-center gap-1 px-[max(0.45rem,env(safe-area-inset-left,0px))] py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href.length > 1 && pathname.startsWith(item.href + "/"));
          const hasUnread = item.badge && unreadCount > 0;

          return (
            <motion.div
              key={item.href}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex min-w-0 items-center justify-center"
            >
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  hasUnread
                    ? `${item.label} (${unreadCount} necitite)`
                    : item.label
                }
                className="touch-target relative flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
              >
                {item.accent ? (
                  <motion.span
                    className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_26px_-12px_rgba(32,231,213,0.85)]"
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            y: isActive ? -3 : 0,
                            scale: isActive ? 1.04 : 1,
                          }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 31,
                      mass: 0.72,
                    }}
                  >
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-white/18"
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0 }}
                      transition={{ duration: 0.18 }}
                    />
                    <Icon className="relative z-10 size-[1.18rem]" />
                  </motion.span>
                ) : (
                  <>
                    <motion.span
                      className="relative flex h-9 min-w-14 items-center justify-center rounded-full"
                      initial={false}
                      animate={{ y: isActive && !shouldReduceMotion ? -2 : 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 430,
                        damping: 34,
                        mass: 0.7,
                      }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="dashboard-bottom-nav-active"
                          className="absolute inset-x-1 inset-y-0 rounded-full bg-primary/10 ring-1 ring-primary/18"
                          transition={{
                            type: "spring",
                            stiffness: 460,
                            damping: 38,
                            mass: 0.8,
                          }}
                        />
                      )}
                      <motion.span
                        initial={false}
                        animate={{
                          scale: isActive && !shouldReduceMotion ? 1.14 : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 32,
                        }}
                        className="relative z-10"
                      >
                        <Icon
                          strokeWidth={isActive ? 2.6 : 1.9}
                          className={cn(
                            "size-[1.12rem] transition-colors duration-200",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      </motion.span>
                      {hasUnread && (
                        <span
                          aria-hidden="true"
                          className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-1 ring-background"
                        />
                      )}
                    </motion.span>
                    <motion.span
                      className={cn(
                        "max-w-[4.8rem] truncate text-[0.65rem] font-medium leading-none transition-colors duration-200",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : 0.78,
                        y: isActive && !shouldReduceMotion ? -1 : 0,
                      }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {item.label}
                    </motion.span>
                  </>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
