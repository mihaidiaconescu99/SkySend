"use client";

import { Moon, Sun } from "lucide-react";
import { m } from "motion/react";
import { useSettings } from "@/lib/settings/settings-context";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, t } = useSettings();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t("preferences.theme.light") : t("preferences.theme.dark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-border/70 bg-secondary/45 p-1 transition-colors duration-300",
        isDark ? "justify-start" : "justify-end",
        className,
      )}
    >
      <span className="sr-only">
        {isDark ? t("preferences.theme.dark") : t("preferences.theme.light")}
      </span>
      <m.span
        layout
        transition={{ type: "spring", stiffness: 460, damping: 32 }}
        className={cn(
          "relative grid size-7 place-items-center rounded-full shadow-[var(--elevation-soft)]",
          isDark
            ? "bg-[linear-gradient(135deg,#0b1220,#1c2a36)] text-[#20e7d5]"
            : "bg-[linear-gradient(135deg,#fcd116,#f59e0b)] text-[#7c2d12]",
        )}
      >
        <m.span
          key={theme}
          initial={{ rotate: isDark ? -90 : 90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {isDark ? (
            <Moon className="size-4" aria-hidden="true" />
          ) : (
            <Sun className="size-4" aria-hidden="true" />
          )}
        </m.span>
      </m.span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full opacity-40 transition-opacity",
          isDark ? "bg-[radial-gradient(circle_at_18%_50%,rgba(32,231,213,0.25),transparent_60%)]" : "bg-[radial-gradient(circle_at_82%_50%,rgba(252,209,22,0.30),transparent_60%)]",
        )}
      />
    </button>
  );
}