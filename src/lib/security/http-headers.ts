type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeaderEnvironment = Record<string, string | undefined>;

function configuredOrigin(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildContentSecurityPolicy(
  environment: SecurityHeaderEnvironment = process.env,
) {
  const supabaseOrigin = configuredOrigin(
    environment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const mapStyleOrigin = configuredOrigin(
    environment.NEXT_PUBLIC_GEOAPIFY_MAP_STYLE,
  );
  const mapTileOrigin = configuredOrigin(
    environment.NEXT_PUBLIC_MAP_TILE_URL,
  );
  const mapGeocodingOrigin = configuredOrigin(
    environment.NEXT_PUBLIC_MAP_GEOCODING_URL,
  );
  const mediaOrigin = configuredOrigin(
    environment.NEXT_PUBLIC_STORYTELLING_MEDIA_BASE_URL,
  );

  const connectSources = unique([
    "'self'",
    supabaseOrigin,
    supabaseOrigin?.replace(/^https:/u, "wss:") ?? null,
    mapStyleOrigin,
    mapTileOrigin,
    mapGeocodingOrigin,
    "https://api.geoapify.com",
    "https://maps.geoapify.com",
    "https://*.geoapify.com",
    "https://api.stripe.com",
    "https://*.stripe.com",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "wss://*.clerk.com",
    "wss://*.clerk.accounts.dev",
  ]);
  const mediaSources = unique([
    "'self'",
    "blob:",
    mediaOrigin,
    "https://media.skysend.website",
  ]);
  const imageSources = unique([
    ...mediaSources,
    "data:",
    mapStyleOrigin,
    mapTileOrigin,
    "https://*.geoapify.com",
    "https://*.stripe.com",
    "https://*.clerk.com",
    "https://img.clerk.com",
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.clerk.com https://*.clerk.accounts.dev`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${imageSources.join(" ")}`,
    `media-src ${mediaSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.clerk.com https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}

export function buildSecurityHeaders(
  environment: SecurityHeaderEnvironment = process.env,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(environment),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com"), usb=(), browsing-topics=()',
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];

  if (
    environment.VERCEL_ENV === "production" &&
    environment.NEXT_PUBLIC_APP_URL?.startsWith("https://")
  ) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  }

  return headers;
}
