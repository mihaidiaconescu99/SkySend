import type { CurrencyCode } from "@/types/entities";

export type Language = "ro" | "en";

export type Theme = "dark" | "light";

export type UserPrefs = {
  language: Language;
  currency: CurrencyCode;
  theme: Theme;
};

export const DEFAULT_PREFS: UserPrefs = {
  language: "ro",
  currency: "RON",
  theme: "dark",
};

export const PREFS_STORAGE_KEY = "skysend:user-prefs";
export const PREFS_COOKIE_NAME = "skysend:user-prefs";

export const LANGUAGES: readonly Language[] = ["ro", "en"];
export const CURRENCIES: readonly CurrencyCode[] = ["RON", "EUR"];
export const THEMES: readonly Theme[] = ["dark", "light"];

export const LANGUAGE_LOCALE: Record<Language, string> = {
  ro: "ro-RO",
  en: "en-US",
};
