"use client";

import { m } from "motion/react";
import { useSettings } from "@/lib/settings/settings-context";
import type { CurrencyCode } from "@/types/entities";
import { cn } from "@/lib/utils";

const CURRENCY_OPTIONS: ReadonlyArray<{
  value: CurrencyCode;
  symbol: string;
  labelKey: "preferences.currency.RON" | "preferences.currency.EUR";
}> = [
  { value: "RON", symbol: "lei", labelKey: "preferences.currency.RON" },
  { value: "EUR", symbol: "€", labelKey: "preferences.currency.EUR" },
];

export function CurrencySwitcher({
  variant = "inline",
}: {
  variant?: "inline" | "stacked";
}) {
  const { currency, setCurrency, t } = useSettings();

  return (
    <div
      role="group"
      aria-label={t("preferences.currency")}
      className={cn(
        "relative grid gap-1",
        variant === "stacked" ? "grid-cols-1" : "grid-cols-2 items-stretch",
      )}
    >
      {CURRENCY_OPTIONS.map((option) => {
        const isActive = currency === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setCurrency(option.value)}
            className={cn(
              "relative isolate flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-2xl border px-3 py-2 text-sm font-medium transition-colors duration-200",
              isActive
                ? "border-primary/45 text-foreground"
                : "border-border/70 bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {isActive ? (
              <m.span
                layoutId="currency-active-pill"
                className="absolute inset-0 -z-10 rounded-[inherit] bg-primary/10 shadow-[inset_0_0_0_1px_rgb(34_211_238_/_0.08),0_8px_28px_-20px_rgb(34_211_238_/_0.9)] backdrop-blur-sm"
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              />
            ) : null}
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary/15 font-heading text-xs font-semibold text-primary">
              {option.symbol}
            </span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-left">
              {t(option.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
