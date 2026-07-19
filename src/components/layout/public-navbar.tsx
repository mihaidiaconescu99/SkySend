"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { HeaderAccount } from "@/components/layout/header-account";
import { publicNavigation } from "@/constants/public-navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings/settings-context";
import { dictionaries } from "@/lib/settings/dictionaries";
import { cn } from "@/lib/utils";

type PublicNavbarProps = {
  overlay?: boolean;
  hideOnScroll?: boolean;
};

function stableMinWidthCh(key: string): string {
  const roLabel = dictionaries.ro[key] ?? "";
  const enLabel = dictionaries.en[key] ?? "";
  const longest = Math.max(roLabel.length, enLabel.length);
  return `${Math.ceil(longest * 1.2)}ch`;
}

export function PublicNavbar({
  overlay = false,
  hideOnScroll = false,
}: PublicNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useSettings();

  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollYRef = useRef(0);

  const opaque = overlay ? scrolled || isOpen : true;
  const transparent = !opaque;

  let navBackground: string;
  let navBorder: string;
  let navBlur: number;
  if (!overlay) {
    navBackground = "rgb(4 10 12 / 0.88)";
    navBorder = "rgb(34 211 238 / 0.7)";
    navBlur = 20;
  } else if (opaque) {
    navBackground = "rgba(5, 7, 10, 0.85)";
    navBorder = "rgba(255, 255, 255, 0.05)";
    navBlur = 12;
  } else {
    navBackground = "rgba(5, 7, 10, 0)";
    navBorder = "rgba(255, 255, 255, 0)";
    navBlur = 0;
  }

  useEffect(() => {
    if (!overlay) return;
    let frame = 0;
    const compute = () => {
      const hero = document.querySelector<HTMLElement>("#main-content section");
      const heroScrollable = hero
        ? hero.offsetHeight - window.innerHeight
        : window.innerHeight * 0.8;

      const threshold =
        heroScrollable > 0 ? heroScrollable * 0.9 : window.innerHeight * 0.8;
      setScrolled(window.scrollY > threshold);
    };
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        compute();
        frame = 0;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [overlay]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    if (!hideOnScroll || isOpen) {
      return;
    }

    let frame = 0;
    const updateDirection = () => {
      frame = 0;
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollYRef.current;

      if (delta < -0.5) {
        setNavHidden(false);
      } else if (delta > 5 && currentY > 96) {
        setNavHidden(true);
      }
      lastScrollYRef.current = currentY;
    };
    const handleScrollDirection = () => {
      if (!frame) frame = window.requestAnimationFrame(updateDirection);
    };

    window.addEventListener("scroll", handleScrollDirection, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScrollDirection);
    };
  }, [hideOnScroll, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter,color,transform] duration-200 ease-out",
        transparent
          ? "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]"
          : "text-foreground",
      )}
      style={{
        backgroundColor: navBackground,
        borderColor: navBorder,
        backdropFilter: `blur(${navBlur}px)`,
        WebkitBackdropFilter: `blur(${navBlur}px)`,
        transform:
          hideOnScroll && navHidden && !isOpen
            ? "translate3d(0, -105%, 0)"
            : "translate3d(0, 0, 0)",
      }}
    >
      <div className="app-container">
        <div className="flex h-14 min-w-0 items-center justify-between gap-4 xl:h-16 xl:gap-6">
          <Link href="/" aria-label={t("brand.homeAria")} className="min-w-0 shrink-0">
            <BrandMark compact />
          </Link>

          <nav
            aria-label={t("nav.mainAria")}
            className="hidden min-w-0 items-center gap-1 xl:flex"
          >
            {publicNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                style={{ minWidth: stableMinWidthCh(item.labelKey) }}
                className={cn(
                  "public-nav-link whitespace-nowrap rounded-full px-3 py-1.5 text-center text-sm transition-colors duration-300",
                  pathname === item.href
                    ? "bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  transparent && "text-white/90 hover:text-white",
                )}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div
            className={cn(
              "hidden shrink-0 items-center gap-2 xl:flex",
              transparent &&
                "[&_[data-variant=ghost]]:text-white/78 [&_[data-variant=ghost]:hover]:bg-white/10 [&_[data-variant=ghost]:hover]:text-white [&_[data-variant=outline]]:border-white/24 [&_[data-variant=outline]]:bg-white/8 [&_[data-variant=outline]]:text-white [&_[data-variant=outline]:hover]:bg-white/14 [&_[data-variant=outline]:hover]:text-white",
            )}
          >
            <HeaderAccount />
            <Button
              asChild
              variant="outline"
              size="sm"
              style={{ minWidth: stableMinWidthCh("nav.app") }}
              className={cn(
                "public-app-button justify-center text-center transition-colors duration-300",
                pathname === "/" && "landing-app-breathe",
                transparent &&
                  "border-white/24 bg-white/8 text-white backdrop-blur-md hover:bg-white/14 hover:text-white",
              )}
            >
              <Link href="/client/create-delivery">{t("nav.app")}</Link>
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("xl:hidden", transparent && "text-white hover:bg-white/12")}
            aria-expanded={isOpen}
            aria-controls="public-mobile-nav"
            aria-label={isOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setIsOpen((v) => !v)}
          >
            <span
              aria-hidden="true"
              className="relative flex size-6 flex-col items-center justify-center gap-[5px]"
            >
              <span
                className={cn(
                  "block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-in-out",
                  isOpen && "translate-y-[7px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-5 rounded-full bg-current transition-all duration-200 ease-in-out",
                  isOpen && "scale-x-0 opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-in-out",
                  isOpen && "-translate-y-[7px] -rotate-45",
                )}
              />
            </span>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <m.div
            key="mobile-nav"
            id="public-mobile-nav"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-3 top-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-background/96 p-2 shadow-[var(--elevation-panel)] backdrop-blur-xl xl:hidden"
          >
            <div
              className="flex flex-col gap-2"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
            >
              <nav aria-label={t("nav.mobileAria")} className="grid gap-1">
                {publicNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary/65 hover:text-primary",
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </nav>

              <div className="grid gap-2 border-t border-border/60 pt-2">
                <HeaderAccount mobile onAction={() => setIsOpen(false)} />
                <Button
                  asChild
                  variant="outline"
                  className={cn(
                    "public-app-button h-11 w-full justify-center rounded-2xl",
                    pathname === "/" && "landing-app-breathe",
                  )}
                >
                  <Link
                    href="/client/create-delivery"
                    onClick={() => setIsOpen(false)}
                  >
                    {t("nav.app")}
                  </Link>
                </Button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
