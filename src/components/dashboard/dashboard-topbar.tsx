"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, ChevronDown, MapPin, Warehouse } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { roleConfigs } from "@/constants/roles";
import { useNotificări } from "@/hooks/use-notifications";
import { useServiceCity } from "@/hooks/use-service-city";
import { getAdminOperationalSettings } from "@/lib/admin-settings";
import { cn } from "@/lib/utils";
import type { OperationalSettings } from "@/types/admin";
import type { DashboardRole } from "@/types/roles";

export function DashboardTopbar({
  role,
  floating = false,
}: {
  role: DashboardRole;
  floating?: boolean;
}) {
  const config = roleConfigs[role];
  const isClientWorkspace = role === "client";
  const pathname = usePathname();
  const userProfileUrl =
    role === "admin" ? "/admin/settings" : role === "operator" ? "/operator" : "/client/settings";
  const shouldShowCitySelector =
    isClientWorkspace && pathname === "/client/create-delivery";
  const isClientTracking =
    isClientWorkspace && Boolean(pathname?.match(/^\/client\/orders\/[^/]+$/));
  const { unreadCount } = useNotificări();
  const { selectedCity, setSelectedCity, serviceCities } = useServiceCity();
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [operationalSettings, setOperationalSettings] =
    useState<OperationalSettings>(() => getAdminOperationalSettings());
  const isPlatformInMaintenance =
    operationalSettings.platformStatus === "maintenance";
  const isHubOnline = selectedCity.hubStatus === "active" && !isPlatformInMaintenance;
  const clientControlClassName = cn(
    "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm leading-tight backdrop-blur-md sm:px-3.5",
    floating
      ? "pointer-events-auto border-white/12 bg-background/95 text-foreground shadow-[0_12px_32px_-18px_rgba(0,0,0,0.95)]"
      : "border-border/70 bg-card/45 text-foreground shadow-[var(--elevation-soft)]",
  );
  const mutedClientControlClassName = cn(
    clientControlClassName,
    floating ? "text-foreground/76" : "text-muted-foreground",
  );
  const iconControlClassName = cn(
    "relative inline-flex size-11 items-center justify-center rounded-full border text-foreground backdrop-blur-md transition-colors focus-visible:ring-4 focus-visible:ring-ring",
    floating
      ? "pointer-events-auto border-white/12 bg-background/95 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.95)] hover:border-primary/35 hover:bg-background"
      : "border-border/70 bg-card/45 shadow-[var(--elevation-soft)] hover:border-primary/45 hover:bg-secondary/70",
  );
  const notificationBadge =
    unreadCount > 0 ? (
      <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[0.65rem] font-semibold leading-4 text-primary-foreground">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    ) : null;

  useEffect(() => {
    function refreshOperationalSettings() {
      setOperationalSettings(getAdminOperationalSettings());
    }

    const refreshFrame = window.requestAnimationFrame(() => {
      refreshOperationalSettings();
    });

    window.addEventListener("skysend:admin-settings-updated", refreshOperationalSettings);
    window.addEventListener("storage", refreshOperationalSettings);

    return () => {
      window.cancelAnimationFrame(refreshFrame);
      window.removeEventListener(
        "skysend:admin-settings-updated",
        refreshOperationalSettings,
      );
      window.removeEventListener("storage", refreshOperationalSettings);
    };
  }, []);

  return (
    <header
      className={cn(
        "min-w-0",
        floating
          ? isClientWorkspace
            ? "px-3 pb-2 pt-[calc(0.55rem_+_env(safe-area-inset-top))] expanded-ui:px-8 expanded-ui:pb-3 expanded-ui:pt-[calc(0.75rem_+_env(safe-area-inset-top))]"
            : "px-3 pt-[calc(0.55rem_+_env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-[calc(0.75rem_+_env(safe-area-inset-top))] sm:pb-3 lg:px-8"
          : "px-1 py-1",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col",
          isClientWorkspace
            ? "expanded-ui:flex-row expanded-ui:items-center expanded-ui:justify-between"
            : "md:flex-row md:items-center md:justify-between",
          floating
            ? isClientWorkspace
              ? "gap-2 expanded-ui:gap-4"
              : "gap-2 sm:gap-3 md:gap-4"
            : "gap-4",
        )}
      >
        <div className={cn("min-w-0 cd-chrome", floating ? "pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.62)]" : undefined)}>
          {isClientWorkspace ? (
            <>
              <Link
                href="/"
                aria-label="Pagina principala SkySend"
                className={cn(
                  "pointer-events-auto hidden w-fit min-w-0 items-center gap-3 rounded-2xl text-foreground outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-ring compact-ui:flex expanded-ui:hidden",
                  isClientTracking ? "compact-ui:hidden" : undefined,
                )}
              >
                <Image
                  src="/icons/icon-192.png"
                  alt=""
                  width={64}
                  height={64}
                  priority
                  className="size-12 shrink-0 object-contain"
                />
                <span className="truncate font-heading text-2xl font-semibold tracking-tight">
                  SkySend
                </span>
              </Link>
              <div className="compact-ui:hidden expanded-ui:block">
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.16em]",
                    floating ? "text-primary/90" : "text-muted-foreground",
                  )}
                >
                  SkySend Pitesti
                </p>
                <h1
                  className={cn(
                    "mt-1 truncate font-heading tracking-tight text-foreground",
                    floating ? "text-xl lg:text-3xl" : "text-3xl",
                  )}
                >
                  {isClientTracking
                    ? "Livrare live"
                    : floating
                      ? "Creeaza livrare"
                      : "Livrare client"}
                </h1>
              </div>
            </>
          ) : (
            <>
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.16em]",
                  floating ? "text-primary/90" : "text-muted-foreground",
                )}
              >
                {config.label}
              </p>
              <h1
                className={cn(
                  "mt-1 truncate font-heading tracking-tight text-foreground",
                  floating ? "text-base sm:text-xl lg:text-3xl" : "text-xl sm:text-3xl",
                )}
              >
                {config.title}
              </h1>
            </>
          )}
        </div>

        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            floating
              ? cn(
                  "flex-nowrap pb-1",
                  shouldShowCitySelector
                    ? "overflow-visible"
                    : "overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                )
              : "flex-wrap",
          )}
        >
          {isClientWorkspace ? (
            <>
              {isClientTracking ? (
                <Link
                  href="/client/orders"
                  aria-label="Înapoi la comenzi"
                  className={cn(
                    iconControlClassName,
                    "compact-ui:hidden expanded-ui:inline-flex",
                  )}
                >
                  <ArrowLeft className="size-4" />
                </Link>
              ) : null}
              {isClientTracking ? (
                <Link
                  href="/client/orders"
                  aria-label="Înapoi la comenzi"
                  className={cn(
                    iconControlClassName,
                    "fixed left-3 top-[calc(0.55rem_+_env(safe-area-inset-top))] z-[60] border-transparent bg-background/80 shadow-none compact-ui:inline-flex expanded-ui:hidden",
                  )}
                >
                  <ArrowLeft className="size-4" />
                </Link>
              ) : null}
              {shouldShowCitySelector ? (
                <div className="relative z-50 cd-chrome">
                <button
                  type="button"
                  onClick={() => setIsCitySelectorOpen((value) => !value)}
                  className={cn(
                    clientControlClassName,
                    "min-w-[9.25rem] justify-between transition-colors hover:border-primary/35 hover:bg-background focus-visible:ring-4 focus-visible:ring-ring",
                  )}
                  aria-expanded={isCitySelectorOpen}
                  aria-haspopup="listbox"
                  aria-label={`Schimbă orașul de operare. Oraș curent: ${selectedCity.label}`}
                >
                  <MapPin className="size-4 text-primary" />
                  <span className="max-w-[5.8rem] truncate sm:max-w-none">
                    {selectedCity.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      isCitySelectorOpen ? "rotate-180" : undefined,
                    )}
                  />
                </button>

                {isCitySelectorOpen ? (
                  <div
                    className={cn(
                      "absolute left-0 top-[calc(100%_+_0.5rem)] z-50 w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/80 bg-background/95 p-1.5 shadow-[var(--elevation-panel)] backdrop-blur-md sm:left-auto sm:right-0 sm:w-auto sm:min-w-48",
                      floating ? "pointer-events-auto" : undefined,
                    )}
                    role="listbox"
                  >
                    {serviceCities.map((city) => {
                      const isSelected = selectedCity.id === city.id;
                      const isUnavailable = city.hubStatus !== "active";

                      return (
                        <button
                          key={city.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedCity(city.id);
                            setIsCitySelectorOpen(false);
                          }}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:ring-4 focus-visible:ring-ring",
                            isSelected
                              ? "bg-primary/12 text-foreground"
                              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                          )}
                        >
                          <span>{city.label}</span>
                          <span className="flex items-center gap-2">
                            {isUnavailable ? (
                              <span className="text-[0.68rem] font-semibold uppercase text-red-300">
                                Indisponibil
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                isUnavailable
                                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]"
                                  : "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]",
                              )}
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                </div>
              ) : null}
              <span
                className={cn(
                  mutedClientControlClassName,
                  "compact-ui:hidden expanded-ui:inline-flex",
                )}
              >
                <Warehouse className="size-4 text-foreground" />
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    isHubOnline
                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                      : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)]",
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap max-[380px]:sr-only">
                  {isPlatformInMaintenance
                    ? "Hub inactiv · Mentenanță"
                    : isHubOnline
                      ? "Hub activ"
                      : "Hub indisponibil"}
                </span>
              </span>
              <Link
                href="/client/notifications"
                aria-label="Notificări"
                className={cn(
                  iconControlClassName,
                  "compact-ui:hidden expanded-ui:inline-flex",
                )}
              >
                <Bell className="size-4" />
                {notificationBadge}
              </Link>
              <Link
                href="/client/notifications"
                aria-label="Notificări"
                className={cn(
                  iconControlClassName,
                  "fixed right-3 top-[calc(0.55rem_+_env(safe-area-inset-top))] z-[60] compact-ui:inline-flex expanded-ui:hidden",
                  floating
                    ? "border-transparent bg-transparent shadow-none backdrop-blur-none hover:border-transparent hover:bg-transparent"
                    : undefined,
                )}
              >
                <Bell className="size-4" />
                {notificationBadge}
              </Link>
            </>
          ) : (
            <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border/70 bg-card/45 px-3.5 py-2 text-sm leading-tight text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur-md">
              <MapPin className="size-4 text-foreground" />
              Spațiu operațional
            </span>
          )}

          {!isClientWorkspace ? (
            <div
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full border backdrop-blur-md",
                floating
                  ? "pointer-events-auto border-white/12 bg-background/10 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.95)]"
                  : "border-border/70 bg-card/45 shadow-[var(--elevation-soft)]",
              )}
            >
              <UserButton
                userProfileMode="navigation"
                userProfileUrl={userProfileUrl}
                appearance={{
                  elements: {
                    avatarBox: "size-9",
                  },
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
