import type { Language } from "@/lib/settings/types";

const roDictionary: Record<string, string> = {
    "a11y.skipToContent": "Sari la conținutul principal",

    "brand.name": "SkySend",
    "brand.homeAria": "Acasă SkySend",

    "nav.howItWorks": "Cum funcționează",
    "nav.pricing": "Tarife",
    "nav.tracking": "Urmărește comanda",
    "nav.contact": "Contact",
    "nav.app": "Aplicație",
    "nav.mainAria": "Navigație principală",
    "nav.mobileAria": "Navigație mobilă",
    "nav.openMenu": "Deschide meniul de navigație",
    "nav.closeMenu": "Închide meniul de navigație",

    "auth.signIn": "Autentificare",
    "auth.signUp": "Creează cont",
    "auth.signOut": "Deconectare",
    "auth.account": "Cont",
    "auth.accountSettings": "Setări cont",
    "auth.guest": "Vizitator",
    "auth.preferences": "Preferințe",

    "preferences.language": "Limbă",
    "preferences.currency": "Monedă",
    "preferences.theme": "Temă",
    "preferences.theme.dark": "Mod întunecat",
    "preferences.theme.light": "Mod luminos",
    "preferences.language.ro": "Română",
    "preferences.language.en": "Engleză",
    "preferences.currency.RON": "Lei românești",
    "preferences.currency.EUR": "Euro",

    "loading.title": "Se încarcă…",
    "loading.titleAlt": "Loading…",

    "settings.preferences.eyebrow": "Preferințe",
    "settings.preferences.title": "Preferințe aplicație",
    "settings.preferences.description": "Limba, moneda și tema se sincronizează în toată aplicația și rămân salvate după reîncărcare.",
    "settings.preferences.note": "Moneda schimbă doar afișarea prețurilor, nu valorile folosite în calcul.",
};

const enDictionary: Record<string, string> = {
  "a11y.skipToContent": "Skip to main content",

    "brand.name": "SkySend",
    "brand.homeAria": "SkySend home",

    "nav.howItWorks": "How it works",
    "nav.pricing": "Pricing",
    "nav.tracking": "Track order",
    "nav.contact": "Contact",
    "nav.app": "App",
    "nav.mainAria": "Main navigation",
    "nav.mobileAria": "Mobile navigation",
    "nav.openMenu": "Open navigation menu",
    "nav.closeMenu": "Close navigation menu",

    "auth.signIn": "Sign in",
    "auth.signUp": "Create account",
    "auth.signOut": "Sign out",
    "auth.account": "Account",
    "auth.accountSettings": "Account settings",
    "auth.guest": "Guest",
    "auth.preferences": "Preferences",

    "preferences.language": "Language",
    "preferences.currency": "Currency",
    "preferences.theme": "Theme",
    "preferences.theme.dark": "Dark mode",
    "preferences.theme.light": "Light mode",
    "preferences.language.ro": "Romanian",
    "preferences.language.en": "English",
    "preferences.currency.RON": "Romanian lei",
    "preferences.currency.EUR": "Euro",

    "loading.title": "Loading…",
    "loading.titleAlt": "Loading…",

    "settings.preferences.eyebrow": "Preferences",
    "settings.preferences.title": "App preferences",
    "settings.preferences.description": "Language, currency and theme are synced across the entire app and stay saved after refresh.",
    "settings.preferences.note": "The currency switch only changes how prices are displayed, not the underlying values.",
};

const translations: Record<Language, Record<string, string>> = {
  ro: roDictionary,
  en: enDictionary,
};

export const dictionaries: Record<Language, Record<string, string>> = translations;

export type TranslationKey = string;

export function translate(language: Language, key: TranslationKey): string {
  return translations[language][key] ?? translations.ro[key] ?? key;
}
