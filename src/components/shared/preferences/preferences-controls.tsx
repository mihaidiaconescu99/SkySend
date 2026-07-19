"use client";

import { LanguageSwitcher } from "@/components/shared/preferences/language-switcher";
import { CurrencySwitcher } from "@/components/shared/preferences/currency-switcher";
import { ThemeToggle } from "@/components/shared/preferences/theme-toggle";
import { useSettings } from "@/lib/settings/settings-context";

export function PreferencesControls({
  showCurrency = true,
  showTheme = true,
}: {
  showCurrency?: boolean;
  showTheme?: boolean;
}) {
  const { t } = useSettings();

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("preferences.language")}
        </p>
        <LanguageSwitcher />
      </div>

      {showCurrency ? (
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("preferences.currency")}
          </p>
          <CurrencySwitcher />
        </div>
      ) : null}

      {showTheme ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/40 px-3 py-2.5">
          <div className="grid gap-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("preferences.theme")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {t("preferences.theme.dark")}
            </p>
          </div>
          <ThemeToggle />
        </div>
      ) : null}
    </div>
  );
}
