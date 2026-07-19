

function req(key: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `[env] Missing required public environment variable: ${key}`,
    );
  }
  return value.trim();
}

function opt(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export const publicEnv = {

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: req(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),

  NEXT_PUBLIC_SUPABASE_URL: req(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: req(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: req(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ),

  NEXT_PUBLIC_APP_URL: opt(
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
  ),

  NEXT_PUBLIC_MAP_PROVIDER: opt(process.env.NEXT_PUBLIC_MAP_PROVIDER, "geoapify"),

  NEXT_PUBLIC_CLERK_SIGN_IN_URL: opt(
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    "/sign-in",
  ),

  NEXT_PUBLIC_CLERK_SIGN_UP_URL: opt(
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    "/sign-up",
  ),

  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: opt(
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
    "/auth/continue",
  ),

  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: opt(
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
    "/auth/continue",
  ),

  NEXT_PUBLIC_GEOAPIFY_API_KEY: opt(process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY, ""),

  NEXT_PUBLIC_MAP_PUBLIC_TOKEN: opt(process.env.NEXT_PUBLIC_MAP_PUBLIC_TOKEN, ""),

  NEXT_PUBLIC_MAP_TILE_URL: opt(process.env.NEXT_PUBLIC_MAP_TILE_URL, ""),

  NEXT_PUBLIC_MAP_GEOCODING_URL: opt(process.env.NEXT_PUBLIC_MAP_GEOCODING_URL, ""),

  NEXT_PUBLIC_GEOAPIFY_MAP_STYLE: opt(
    process.env.NEXT_PUBLIC_GEOAPIFY_MAP_STYLE,
    "",
  ),
} as const;

export const envKeys = {
  publicRequired: [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ] as const,
  publicOptional: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_MAP_PROVIDER",
    "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
    "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
    "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
    "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
    "NEXT_PUBLIC_GEOAPIFY_API_KEY",
    "NEXT_PUBLIC_MAP_PUBLIC_TOKEN",
    "NEXT_PUBLIC_MAP_TILE_URL",
    "NEXT_PUBLIC_MAP_GEOCODING_URL",
    "NEXT_PUBLIC_GEOAPIFY_MAP_STYLE",
  ] as const,
} as const;
