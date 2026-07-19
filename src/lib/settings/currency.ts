import type { CurrencyCode } from "@/types/entities";
import { LANGUAGE_LOCALE, type Language } from "@/lib/settings/types";

export const EXCHANGE_RON_PER_EUR = 4.97;

export function formatMoneyMinor(
  amountMinor: number,
  options: {
    targetCurrency?: CurrencyCode;
    locale?: string;
  } = {},
): string {
  const targetCurrency = options.targetCurrency ?? "RON";
  const locale = options.locale ?? "ro-RO";

  const converted = convertMinorForDisplay(amountMinor, targetCurrency);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: targetCurrency,
    maximumFractionDigits: 2,
  }).format(converted / 100);
}

export function formatCurrency(
  amountMinor: number,
  currency: CurrencyCode = "RON",
): string {
  return formatMoneyMinor(amountMinor, { targetCurrency: currency });
}

export function convertMinorForDisplay(
  amountMinor: number,
  targetCurrency: CurrencyCode,
): number {
  if (targetCurrency === "EUR") {
    const ron = amountMinor / 100;
    const eur = ron / EXCHANGE_RON_PER_EUR;
    return Math.round(eur * 100);
  }
  return amountMinor;
}

export function localeForLanguage(language: Language): string {
  return LANGUAGE_LOCALE[language];
}
