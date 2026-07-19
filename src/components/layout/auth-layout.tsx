"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { useSettings } from "@/lib/settings/settings-context";

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useSettings();

  return (
    <div className="app-shell min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(32,231,213,0.10),transparent_34rem),linear-gradient(180deg,#05070A_0%,#071017_100%)]">
      <div className="app-container flex min-h-svh flex-col gap-3 px-4 py-3 sm:gap-8 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex items-center">
          <Link
            href="/"
            aria-label={t("brand.homeAria")}
            className="rounded-2xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-4 focus-visible:ring-ring"
          >
            <BrandMark compact />
          </Link>
        </div>

        <main
          id="main-content"
          className="flex flex-1 items-center justify-center py-0 md:py-6"
        >
          <section className="mx-auto flex w-full max-w-[31rem] justify-center">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}