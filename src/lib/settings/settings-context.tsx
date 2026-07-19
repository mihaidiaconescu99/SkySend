"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_PREFS,
  LANGUAGE_LOCALE,
  PREFS_COOKIE_NAME,
  PREFS_STORAGE_KEY,
  type Language,
  type Theme,
  type UserPrefs,
} from "@/lib/settings/types";
import type { CurrencyCode } from "@/types/entities";
import { formatMoneyMinor } from "@/lib/settings/currency";
import { translate, type TranslationKey } from "@/lib/settings/dictionaries";
import { effectiveThemeForPathname } from "@/lib/settings/theme-route";
import { LoadingOverlay } from "@/components/shared/preferences/loading-overlay";

const PREFS_CHANGED_EVENT = "skysend:user-prefs-changed";

export interface SettingsContextValue {
  prefs: UserPrefs;
  language: Language;
  currency: CurrencyCode;
  theme: Theme;
  effectiveTheme: Theme;
  locale: string;
  setLanguage: (next: Language) => void;
  setCurrency: (next: CurrencyCode) => void;
  setTheme: (next: Theme) => void;
  t: (key: TranslationKey) => string;
  formatCurrency: (amountMinor: number) => string;
  isSwitching: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === "ro" || value === "en";
}

function isCurrency(value: unknown): value is CurrencyCode {
  return value === "RON" || value === "EUR";
}

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

function coercePrefs(raw: unknown): UserPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (!isLanguage(candidate.language)) return null;
  if (!isCurrency(candidate.currency)) return null;
  if (!isTheme(candidate.theme)) return null;
  return {
    language: candidate.language,
    currency: candidate.currency,
    theme: candidate.theme,
  };
}

function readPrefsFromStorage(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return coercePrefs(JSON.parse(raw)) ?? DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function persistPrefs(prefs: UserPrefs) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(prefs);
    window.localStorage.setItem(PREFS_STORAGE_KEY, serialized);
    document.cookie = `${PREFS_COOKIE_NAME}=${encodeURIComponent(
      serialized,
    )}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* quota / private mode — ignore */
  }
}

function applyPrefsToDocument(prefs: UserPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effectiveTheme = effectiveThemeForPathname(
    window.location.pathname,
    prefs.theme,
  );
  root.classList.toggle("dark", effectiveTheme === "dark");
  root.classList.toggle("light", effectiveTheme === "light");
  root.style.colorScheme = effectiveTheme === "dark" ? "dark" : "light";
  root.lang = prefs.language;
}

function enableThemeTransition() {
  if (typeof document === "undefined") return;
  document.body.dataset.themeTransition = "true";
}

function disableThemeTransition() {
  if (typeof document === "undefined") return;
  delete document.body.dataset.themeTransition;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [isSwitching, setIsSwitching] = useState(false);
  const switchingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialHydrated = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const stored = readPrefsFromStorage();
      setPrefs(stored);
      applyPrefsToDocument(stored);
      initialHydrated.current = true;
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    applyPrefsToDocument(prefs);
  }, [pathname, prefs]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== PREFS_STORAGE_KEY) return;
      const next = coercePrefs(
        event.newValue ? JSON.parse(event.newValue) : null,
      );
      if (!next) return;
      setPrefs(next);
      applyPrefsToDocument(next);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const scheduleSwitching = useCallback(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    setIsSwitching(true);
    if (switchingTimer.current) clearTimeout(switchingTimer.current);
    switchingTimer.current = setTimeout(() => {
      setIsSwitching(false);
      switchingTimer.current = null;
    }, 720);
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<UserPrefs>, opts: { animate?: boolean } = {}) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        persistPrefs(next);
        applyPrefsToDocument(next);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(PREFS_CHANGED_EVENT));
        }
        const significant =
          patch.language !== undefined || patch.theme !== undefined;
        if (significant && opts.animate !== false) {
          enableThemeTransition();
          scheduleSwitching();
          window.setTimeout(disableThemeTransition, 420);
        }
        return next;
      });
    },
    [scheduleSwitching],
  );

  const setLanguage = useCallback(
    (next: Language) => updatePrefs({ language: next }),
    [updatePrefs],
  );
  const setCurrency = useCallback(
    (next: CurrencyCode) => updatePrefs({ currency: next }),
    [updatePrefs],
  );
  const setTheme = useCallback(
    (next: Theme) => updatePrefs({ theme: next }),
    [updatePrefs],
  );

  const value = useMemo<SettingsContextValue>(() => {
    const locale = LANGUAGE_LOCALE[prefs.language];
    const effectiveTheme = effectiveThemeForPathname(pathname ?? "", prefs.theme);
    return {
      prefs,
      language: prefs.language,
      currency: prefs.currency,
      theme: prefs.theme,
      effectiveTheme,
      locale,
      setLanguage,
      setCurrency,
      setTheme,
      t: (key) => translate(prefs.language, key),
      formatCurrency: (amountMinor) =>
        formatMoneyMinor(amountMinor, {
          targetCurrency: prefs.currency,
          locale,
        }),
      isSwitching,
    };
  }, [prefs, setLanguage, setCurrency, setTheme, isSwitching, pathname]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <LoadingOverlay active={isSwitching} theme={value.effectiveTheme} />
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within <SettingsProvider>.");
  }
  return ctx;
}
