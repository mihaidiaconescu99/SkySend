import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security/http-headers";

function headerMap(environment: Record<string, string | undefined>) {
  return new Map(
    buildSecurityHeaders(environment).map(({ key, value }) => [key, value]),
  );
}

describe("security headers", () => {
  it("enforces low-risk browser protections and keeps CSP in report-only mode", () => {
    const headers = headerMap({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_STORYTELLING_MEDIA_BASE_URL:
        "https://media.skysend.website/releases/current",
    });

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.get("Content-Security-Policy-Report-Only")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("allows the configured Clerk, Stripe, Supabase, map and media origins", () => {
    const policy = buildContentSecurityPolicy({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_MAP_TILE_URL: "https://tiles.example.test/{z}/{x}/{y}.png",
      NEXT_PUBLIC_MAP_GEOCODING_URL:
        "https://geocode.example.test/v1/search",
      NEXT_PUBLIC_STORYTELLING_MEDIA_BASE_URL:
        "https://media.skysend.website/releases/current",
    });

    expect(policy).toContain("https://project.supabase.co");
    expect(policy).toContain("wss://project.supabase.co");
    expect(policy).toContain("https://js.stripe.com");
    expect(policy).toContain("https://*.clerk.accounts.dev");
    expect(policy).toContain("https://api.geoapify.com");
    expect(policy).toContain("https://tiles.example.test");
    expect(policy).toContain("https://geocode.example.test");
    expect(policy).toContain("https://media.skysend.website");
  });

  it("adds HSTS only for confirmed Vercel production HTTPS", () => {
    expect(
      headerMap({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://skysend.website",
      }).get("Strict-Transport-Security"),
    ).toBe("max-age=31536000");
    expect(
      headerMap({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_APP_URL: "https://preview.skysend.website",
      }).has("Strict-Transport-Security"),
    ).toBe(false);
    expect(
      headerMap({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }).has("Strict-Transport-Security"),
    ).toBe(false);
  });
});
