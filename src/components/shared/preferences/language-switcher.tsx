"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import { useSettings } from "@/lib/settings/settings-context";
import type { Language } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

function RomaniaFlag() {
  return (
    <svg viewBox="0 0 24 18" className="size-[18px] rounded-[3px]" aria-hidden="true">
      <rect width="8" height="18" x="0" fill="#002b7f" />
      <rect width="8" height="18" x="8" fill="#fcd116" />
      <rect width="8" height="18" x="16" fill="#ce1126" />
    </svg>
  );
}

function UsaFlag() {
  return (
    <svg viewBox="0 0 24 18" className="size-[18px] rounded-[3px]" aria-hidden="true">
      <rect width="24" height="18" fill="#fff" />
      <g fill="#b22234">
        <rect width="24" height="1.8" y="0" />
        <rect width="24" height="1.8" y="3.6" />
        <rect width="24" height="1.8" y="7.2" />
        <rect width="24" height="1.8" y="10.8" />
        <rect width="24" height="1.8" y="14.4" />
      </g>
      <rect width="9.6" height="9" x="0" fill="#3c3b6e" />
    </svg>
  );
}

const LANGUAGE_OPTIONS: ReadonlyArray<{
  value: Language;
  labelKey: "preferences.language.ro" | "preferences.language.en";
  Flag: () => ReactNode;
}> = [
  { value: "ro", labelKey: "preferences.language.ro", Flag: RomaniaFlag },
  { value: "en", labelKey: "preferences.language.en", Flag: UsaFlag },
];

export function LanguageSwitcher({
  variant = "inline",
}: {
  variant?: "inline" | "stacked";
}) {
  const { language, setLanguage, t } = useSettings();

  return (
    <div
      role="group"
      aria-label={t("preferences.language")}
      className={cn(
        "relative grid gap-1",
        variant === "stacked" ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const isActive = language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLanguage(option.value)}
            className={cn(
              "relative isolate flex items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-2 text-sm font-medium transition-colors duration-200",
              isActive
                ? "border-primary/45 text-foreground"
                : "border-border/70 bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {isActive ? (
              <m.span
                layoutId="language-active-pill"
                className="absolute inset-0 -z-10 rounded-[inherit] bg-primary/10 shadow-[inset_0_0_0_1px_rgb(34_211_238_/_0.08),0_8px_28px_-20px_rgb(34_211_238_/_0.9)] backdrop-blur-sm"
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              />
            ) : null}
            <span className="relative overflow-hidden rounded-[3px] ring-1 ring-black/10">
              <option.Flag />
            </span>
            <span className="min-w-0 flex-1">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
