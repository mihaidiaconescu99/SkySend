import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_PREFS,
  PREFS_COOKIE_NAME,
  type Language,
  type Theme,
  type UserPrefs,
} from "@/lib/settings/types";
import type { CurrencyCode } from "@/types/entities";

export async function readPrefsFromCookies(): Promise<UserPrefs> {
  const store = await cookies();
  const raw = store.get(PREFS_COOKIE_NAME)?.value;
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<UserPrefs>;
    if (
      parsed.language === "ro" ||
      parsed.language === "en"
    ) {
      const language = parsed.language;
      const currency: CurrencyCode =
        parsed.currency === "RON" || parsed.currency === "EUR"
          ? parsed.currency
          : DEFAULT_PREFS.currency;
      const theme: Theme =
        parsed.theme === "dark" || parsed.theme === "light"
          ? parsed.theme
          : DEFAULT_PREFS.theme;
      return { language, currency, theme };
    }
  } catch {
    /* ignore malformed cookie */
  }
  return DEFAULT_PREFS;
}

export async function getLanguageFromCookies(): Promise<Language> {
  const prefs = await readPrefsFromCookies();
  return prefs.language;
}
