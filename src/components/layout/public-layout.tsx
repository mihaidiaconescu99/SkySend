"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { useInertiaScroll } from "@/hooks/use-inertia-scroll";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isStorytellingRoute = isHomePage || pathname === "/how-it-works";

  useInertiaScroll(
    !isStorytellingRoute || isHomePage,
    isHomePage
      ? { duration: 1000, maxGlideDistance: 220, glideMultiplier: 2 }
      : undefined,
  );

  return (
    <MotionProvider>
      <div
        className={cn(
          "app-shell flex flex-col overflow-x-clip",
          isStorytellingRoute && "bg-[#02070d] text-[#f2efe6]",
        )}
        data-storytelling-route={isStorytellingRoute ? "true" : undefined}
        data-homepage={isHomePage ? "true" : undefined}
      >
        <PublicNavbar overlay={isStorytellingRoute} hideOnScroll={isHomePage} />
        <main
          id="main-content"
          className={cn(
            "flex-1",
            !isStorytellingRoute && "pt-[calc(5rem_+_env(safe-area-inset-top))]",
          )}
        >
          {isStorytellingRoute ? (
            children
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="app-container app-page-spacing app-section-stack"
              >
                {children}
              </m.div>
            </AnimatePresence>
          )}
        </main>
        <PublicFooter />
      </div>
    </MotionProvider>
  );
}
