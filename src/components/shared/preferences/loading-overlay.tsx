"use client";

import { AnimatePresence, m } from "motion/react";
import { BrandMark } from "@/components/shared/brand-mark";
import { useSettings } from "@/lib/settings/settings-context";

type LoadingOverlayProps = {
  active: boolean;
  theme: "dark" | "light";
};

export function LoadingOverlay({ active, theme }: LoadingOverlayProps) {
  const { language } = useSettings();

  return (
    <AnimatePresence>
      {active ? (
        <m.div
          key="loading-overlay"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-[120] grid place-items-center"
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(circle at 20% 0%, rgba(32, 231, 213, 0.06), transparent 28rem), linear-gradient(180deg, #071017 0%, var(--background) 42rem)"
                : "radial-gradient(circle at 20% 0%, rgba(32, 231, 213, 0.12), transparent 28rem), linear-gradient(180deg, #eef4f8 0%, var(--background) 42rem)",
          }}
        >
          <div className="flex flex-col items-center gap-5">
            <m.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <BrandMark compact />
            </m.div>
            <m.p
              key={language}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.72, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-sm font-medium tracking-wide text-muted-foreground"
            >
              {language === "ro" ? "Se încarcă…" : "Loading…"}
            </m.p>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
