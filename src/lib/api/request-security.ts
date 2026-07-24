import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

type SameOriginOptions = {
  canonicalOrigin?: string | null;
  environment?: string;
};

export type SameOriginDecision =
  | { ok: true; origin: string | null }
  | {
      ok: false;
      status: 403 | 503;
      error: "invalid_request_origin" | "request_origin_required" | "origin_not_configured";
    };

function parseOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string) {
  const url = new URL(origin);
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]")
  );
}

export function getConfiguredAppOrigin() {
  return parseOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim());
}

export function getTrustedAppOrigin(request?: Request) {
  const configured = getConfiguredAppOrigin();
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production" && request) {
    const requestOrigin = new URL(request.url).origin;
    if (isLocalDevelopmentOrigin(requestOrigin)) return requestOrigin;
  }

  throw new Error("origin_not_configured");
}

export function evaluateSameOriginRequest(
  request: Request,
  options: SameOriginOptions = {},
): SameOriginDecision {
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";
  const configured =
    options.canonicalOrigin === undefined
      ? getConfiguredAppOrigin()
      : parseOrigin(options.canonicalOrigin);
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase() ?? null;
  const suppliedOrigin = request.headers.get("origin");

  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, error: "invalid_request_origin" };
  }

  if (!suppliedOrigin) {
    const isNonBrowserBearerClient =
      request.headers.has("authorization") &&
      !request.headers.has("cookie") &&
      fetchSite === null;
    if (environment !== "production" || isNonBrowserBearerClient) {
      return { ok: true, origin: null };
    }
    return { ok: false, status: 403, error: "request_origin_required" };
  }

  const origin = parseOrigin(suppliedOrigin);
  if (!origin) {
    return { ok: false, status: 403, error: "invalid_request_origin" };
  }

  if (configured && origin === configured) {
    return { ok: true, origin };
  }

  if (environment !== "production" && isLocalDevelopmentOrigin(origin)) {
    return { ok: true, origin };
  }

  if (!configured && environment === "production") {
    return { ok: false, status: 503, error: "origin_not_configured" };
  }

  return { ok: false, status: 403, error: "invalid_request_origin" };
}

export function requireSameOrigin(request: Request) {
  const decision = evaluateSameOriginRequest(request);
  if (decision.ok) return null;
  return NextResponse.json(
    { error: decision.error },
    { status: decision.status },
  );
}

export function bearerSecretMatches(
  authorization: string | null,
  secret: string | null | undefined,
) {
  const expectedSecret = secret?.trim();
  if (!expectedSecret || !authorization?.startsWith("Bearer ")) return false;
  const suppliedSecret = authorization.slice("Bearer ".length);
  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(suppliedSecret);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
