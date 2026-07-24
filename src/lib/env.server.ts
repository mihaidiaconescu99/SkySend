

import "server-only";

function req(key: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `[env] Missing required server environment variable: ${key}`,
    );
  }
  return value.trim();
}

function opt(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export const serverEnv = {

  CLERK_SECRET_KEY: req("CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY),

  SUPABASE_SERVICE_ROLE_KEY: req(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),

  STRIPE_SECRET_KEY: req("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),

  STRIPE_WEBHOOK_SECRET: opt(process.env.STRIPE_WEBHOOK_SECRET, ""),

  INVOICE_GENERATOR_API_KEY: opt(process.env.INVOICE_GENERATOR_API_KEY, ""),
  INVOICE_ISSUER_LEGAL_NAME: opt(process.env.INVOICE_ISSUER_LEGAL_NAME, "SkySend"),
  INVOICE_ISSUER_ADDRESS: opt(process.env.INVOICE_ISSUER_ADDRESS, ""),
  INVOICE_ISSUER_CITY: opt(process.env.INVOICE_ISSUER_CITY, ""),
  INVOICE_ISSUER_REGION: opt(process.env.INVOICE_ISSUER_REGION, ""),
  INVOICE_ISSUER_COUNTRY: opt(process.env.INVOICE_ISSUER_COUNTRY, "Romania"),
  INVOICE_ISSUER_POSTAL_CODE: opt(process.env.INVOICE_ISSUER_POSTAL_CODE, ""),
  INVOICE_ISSUER_TAX_ID: opt(process.env.INVOICE_ISSUER_TAX_ID, ""),
  INVOICE_ISSUER_EMAIL: opt(process.env.INVOICE_ISSUER_EMAIL, ""),
  INVOICE_LOGO_URL: opt(process.env.INVOICE_LOGO_URL, ""),

  MAP_PROVIDER_SECRET_KEY: opt(process.env.MAP_PROVIDER_SECRET_KEY, ""),

  RESEND_API_KEY: opt(process.env.RESEND_API_KEY, ""),

  RESEND_FROM_EMAIL: opt(
    process.env.RESEND_FROM_EMAIL,
    "SkySend Support <support@skysend.ro>",
  ),

  RESEND_INBOUND_DOMAIN: opt(
    process.env.RESEND_INBOUND_DOMAIN,
    "nexaev.resend.app",
  ),

  RESEND_WEBHOOK_SECRET: opt(process.env.RESEND_WEBHOOK_SECRET, ""),

  CLOUDFLARE_R2_ACCOUNT_ID: opt(process.env.CLOUDFLARE_R2_ACCOUNT_ID, ""),

  CLOUDFLARE_R2_ACCESS_KEY_ID: opt(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    "",
  ),

  CLOUDFLARE_R2_SECRET_ACCESS_KEY: opt(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    "",
  ),

  CLOUDFLARE_R2_BUCKET: opt(process.env.CLOUDFLARE_R2_BUCKET, ""),

  CLOUDFLARE_R2_ENDPOINT: opt(process.env.CLOUDFLARE_R2_ENDPOINT, ""),

  CLERK_INTERNAL_ORGANIZATION_ID: opt(
    process.env.CLERK_INTERNAL_ORGANIZATION_ID,
    "",
  ),

  OVERPASS_API_URL: opt(
    process.env.OVERPASS_API_URL,
    "https://overpass-api.de/api/interpreter",
  ),

  OPENROUTER_API_KEY: opt(process.env.OPENROUTER_API_KEY, ""),

  OPENROUTER_MODEL: opt(process.env.OPENROUTER_MODEL, ""),

  OPENROUTER_PARCEL_VISION_MODEL: opt(
    process.env.OPENROUTER_PARCEL_VISION_MODEL,
    "openrouter/free",
  ),

  OPENROUTER_SITE_URL: opt(process.env.OPENROUTER_SITE_URL, ""),

  OPENROUTER_APP_NAME: opt(process.env.OPENROUTER_APP_NAME, ""),

  OPENAI_API_KEY: opt(process.env.OPENAI_API_KEY, ""),

  TAVILY_API_KEY: opt(process.env.TAVILY_API_KEY, ""),

  OPEN_FOOD_FACTS_USER_AGENT: opt(
    process.env.OPEN_FOOD_FACTS_USER_AGENT,
    "SkySend Parcel AI/1.0 (https://skysend.website)",
  ),

  ICECAT_USERNAME: opt(process.env.ICECAT_USERNAME, ""),

  ICECAT_PASSWORD: opt(process.env.ICECAT_PASSWORD, ""),
} as const;
