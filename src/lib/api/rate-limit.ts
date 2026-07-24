import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

import { getConfiguredAppOrigin } from "@/lib/api/request-security";

export type RateLimitClass =
  | "public-contact"
  | "assistant"
  | "parcel-estimate"
  | "handoff"
  | "tracking-lookup"
  | "tracking-action"
  | "sync-profile"
  | "upload"
  | "download"
  | "support"
  | "email"
  | "payment"
  | "admin-read"
  | "admin-write";

export type RateLimitBucket = {
  name: string;
  limit: number;
  authenticatedLimit?: number;
  windowSeconds: number;
};

export type RateLimitBackendInput = {
  keyHash: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
  nowMs: number;
};

export type RateLimitBackendResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitBackend {
  consume(input: RateLimitBackendInput): Promise<RateLimitBackendResult>;
}

const policies: Record<RateLimitClass, readonly RateLimitBucket[]> = {
  "public-contact": [
    { name: "burst", limit: 3, authenticatedLimit: 5, windowSeconds: 60 },
    { name: "sustained", limit: 5, authenticatedLimit: 15, windowSeconds: 600 },
  ],
  assistant: [
    { name: "burst", limit: 6, authenticatedLimit: 12, windowSeconds: 60 },
    { name: "sustained", limit: 30, authenticatedLimit: 90, windowSeconds: 3600 },
  ],
  "parcel-estimate": [
    { name: "burst", limit: 3, authenticatedLimit: 6, windowSeconds: 60 },
    { name: "sustained", limit: 12, authenticatedLimit: 30, windowSeconds: 3600 },
  ],
  handoff: [
    { name: "burst", limit: 10, authenticatedLimit: 20, windowSeconds: 60 },
    { name: "sustained", limit: 60, authenticatedLimit: 180, windowSeconds: 3600 },
  ],
  "tracking-lookup": [
    { name: "burst", limit: 20, authenticatedLimit: 40, windowSeconds: 60 },
    { name: "sustained", limit: 120, authenticatedLimit: 300, windowSeconds: 3600 },
  ],
  "tracking-action": [
    { name: "burst", limit: 8, authenticatedLimit: 15, windowSeconds: 60 },
    { name: "sustained", limit: 40, authenticatedLimit: 120, windowSeconds: 3600 },
  ],
  "sync-profile": [
    { name: "burst", limit: 5, authenticatedLimit: 10, windowSeconds: 60 },
    { name: "sustained", limit: 30, authenticatedLimit: 60, windowSeconds: 3600 },
  ],
  upload: [
    { name: "burst", limit: 5, authenticatedLimit: 10, windowSeconds: 60 },
    { name: "sustained", limit: 20, authenticatedLimit: 60, windowSeconds: 3600 },
  ],
  download: [
    { name: "burst", limit: 20, authenticatedLimit: 40, windowSeconds: 60 },
    { name: "sustained", limit: 120, authenticatedLimit: 300, windowSeconds: 3600 },
  ],
  support: [
    { name: "burst", limit: 8, authenticatedLimit: 15, windowSeconds: 60 },
    { name: "sustained", limit: 50, authenticatedLimit: 150, windowSeconds: 3600 },
  ],
  email: [
    { name: "burst", limit: 3, authenticatedLimit: 8, windowSeconds: 60 },
    { name: "sustained", limit: 15, authenticatedLimit: 50, windowSeconds: 3600 },
  ],
  payment: [
    { name: "burst", limit: 6, authenticatedLimit: 20, windowSeconds: 60 },
    { name: "sustained", limit: 20, authenticatedLimit: 100, windowSeconds: 3600 },
  ],
  "admin-read": [
    { name: "burst", limit: 30, authenticatedLimit: 60, windowSeconds: 60 },
    { name: "sustained", limit: 300, authenticatedLimit: 600, windowSeconds: 3600 },
  ],
  "admin-write": [
    { name: "burst", limit: 10, authenticatedLimit: 25, windowSeconds: 60 },
    { name: "sustained", limit: 100, authenticatedLimit: 250, windowSeconds: 3600 },
  ],
};

const failClosedClasses = new Set<RateLimitClass>([
  "public-contact",
  "assistant",
  "parcel-estimate",
  "handoff",
  "upload",
  "email",
  "payment",
]);

type MemoryRecord = {
  count: number;
  expiresAt: number;
};

export class MemoryRateLimitBackend implements RateLimitBackend {
  private readonly records = new Map<string, MemoryRecord>();
  private operations = 0;

  async consume(input: RateLimitBackendInput): Promise<RateLimitBackendResult> {
    this.operations += 1;
    if (this.operations % 100 === 0 || this.records.size > 10_000) {
      this.cleanup(input.nowMs);
    }

    const key = `${input.keyHash}:${input.bucket}`;
    const current = this.records.get(key);
    const record =
      !current || current.expiresAt <= input.nowMs
        ? {
            count: 1,
            expiresAt: input.nowMs + input.windowSeconds * 1000,
          }
        : {
            count: Math.min(current.count + 1, input.limit + 1),
            expiresAt: current.expiresAt,
          };
    this.records.set(key, record);

    return {
      allowed: record.count <= input.limit,
      remaining: Math.max(0, input.limit - record.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((record.expiresAt - input.nowMs) / 1000),
      ),
    };
  }

  cleanup(nowMs: number) {
    for (const [key, record] of this.records) {
      if (record.expiresAt <= nowMs) this.records.delete(key);
    }
    if (this.records.size <= 10_000) return;
    const excess = this.records.size - 10_000;
    let removed = 0;
    for (const key of this.records.keys()) {
      this.records.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }

  clear() {
    this.records.clear();
    this.operations = 0;
  }
}

class PostgresRateLimitBackend implements RateLimitBackend {
  async consume(input: RateLimitBackendInput): Promise<RateLimitBackendResult> {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
    const client = createAdminSupabaseClient() as unknown as {
      rpc: (
        name: string,
        args: Record<string, string | number>,
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data, error } = await Promise.race([
      client.rpc("consume_application_rate_limit", {
        p_key_hash: input.keyHash,
        p_bucket: input.bucket,
        p_limit: input.limit,
        p_window_seconds: input.windowSeconds,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("rate_limit_backend_timeout")),
          1_500,
        );
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    if (error) throw new Error(error.message || "rate_limit_backend_failed");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      throw new Error("rate_limit_backend_invalid_response");
    }
    const result = row as Record<string, unknown>;
    if (
      typeof result.allowed !== "boolean" ||
      typeof result.remaining !== "number" ||
      typeof result.retry_after_seconds !== "number"
    ) {
      throw new Error("rate_limit_backend_invalid_response");
    }
    return {
      allowed: result.allowed,
      remaining: Math.max(0, Math.trunc(result.remaining)),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(result.retry_after_seconds),
      ),
    };
  }
}

const processMemoryBackend = new MemoryRateLimitBackend();
const postgresBackend = new PostgresRateLimitBackend();

function parseSingleIp(value: string | null) {
  const candidate = value?.trim() ?? "";
  return candidate && !candidate.includes(",") && isIP(candidate)
    ? candidate
    : null;
}

export function getTrustedClientIp(
  request: Request,
  environment: string = process.env.NODE_ENV ?? "development",
) {
  const requestUrl = new URL(request.url);
  const configuredOrigin = getConfiguredAppOrigin();
  const canonicalHost = configuredOrigin
    ? new URL(configuredOrigin).hostname
    : null;
  const host = request.headers.get("host")?.split(":", 1)[0]?.toLowerCase();
  const isCanonicalCloudflareRequest =
    canonicalHost !== null &&
    host === canonicalHost &&
    request.headers.has("cf-ray");

  if (isCanonicalCloudflareRequest) {
    const cloudflareIp = parseSingleIp(request.headers.get("cf-connecting-ip"));
    if (cloudflareIp) return cloudflareIp;
  }

  if (process.env.VERCEL === "1") {
    const vercelIp = parseSingleIp(
      request.headers.get("x-vercel-forwarded-for"),
    );
    if (vercelIp) return vercelIp;
  }

  if (environment !== "production") {
    const developmentIp = parseSingleIp(
      request.headers.get("x-forwarded-for"),
    );
    if (developmentIp) return developmentIp;
    if (["localhost", "127.0.0.1", "::1"].includes(requestUrl.hostname)) {
      return "127.0.0.1";
    }
  }

  return null;
}

function getHashSecret(environment: string) {
  const configured = process.env.RATE_LIMIT_HMAC_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (environment !== "production") {
    return "skysend-development-rate-limit-secret";
  }
  return null;
}

function hashIdentity(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

async function resolveUserId(explicitUserId: string | null | undefined) {
  if (explicitUserId !== undefined) return explicitUserId;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session.userId;
  } catch {
    return null;
  }
}

function demoPolicies(environment: string) {
  if (environment === "production") return null;
  const limit = Number(process.env.RATE_LIMIT_DEMO_MAX);
  const windowSeconds = Number(process.env.RATE_LIMIT_DEMO_WINDOW_SECONDS);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > 3600
  ) {
    return null;
  }
  return [{ name: "demo", limit, windowSeconds }] satisfies RateLimitBucket[];
}

export async function evaluateRateLimit(input: {
  rateClass: RateLimitClass;
  identity: string;
  authenticated: boolean;
  backend: RateLimitBackend;
  nowMs?: number;
  buckets?: readonly RateLimitBucket[];
  hashSecret?: string;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const secret =
    input.hashSecret ?? getHashSecret(process.env.NODE_ENV ?? "development");
  if (!secret) throw new Error("rate_limit_secret_missing");
  const keyHash = hashIdentity(input.identity, secret);
  const buckets = input.buckets ?? policies[input.rateClass];

  for (const bucket of buckets) {
    const limit =
      input.authenticated && bucket.authenticatedLimit
        ? bucket.authenticatedLimit
        : bucket.limit;
    const result = await input.backend.consume({
      keyHash,
      bucket: `${input.rateClass}:${bucket.name}`,
      limit,
      windowSeconds: bucket.windowSeconds,
      nowMs,
    });
    if (!result.allowed) return result;
  }

  return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
}

function retryResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "rate_limited",
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "rate_limit_unavailable" },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "5",
      },
    },
  );
}

export async function enforceRateLimit(
  request: Request,
  rateClass: RateLimitClass,
  options: {
    userId?: string | null;
    backend?: RateLimitBackend;
    nowMs?: number;
    buckets?: readonly RateLimitBucket[];
    environment?: string;
  } = {},
) {
  const environment =
    options.environment ?? process.env.NODE_ENV ?? "development";
  if (
    environment === "test" &&
    !options.backend &&
    !process.env.RATE_LIMIT_DEMO_MAX
  ) {
    return null;
  }
  const userId = await resolveUserId(options.userId);
  const trustedIp = userId ? null : getTrustedClientIp(request, environment);
  const identity = userId
    ? `user:${userId}`
    : trustedIp
      ? `ip:${trustedIp}`
      : "ip:unattributed";
  const selectedBackend =
    options.backend ??
    (environment === "production" ? postgresBackend : processMemoryBackend);
  const selectedBuckets =
    options.buckets ?? demoPolicies(environment) ?? policies[rateClass];

  try {
    const result = await evaluateRateLimit({
      rateClass,
      identity,
      authenticated: Boolean(userId),
      backend: selectedBackend,
      nowMs: options.nowMs,
      buckets: selectedBuckets,
    });
    return result.allowed ? null : retryResponse(result.retryAfterSeconds);
  } catch (error) {
    console.error("[rate-limit] backend unavailable", {
      rateClass,
      reason: error instanceof Error ? error.message : "unknown",
    });
    if (environment === "production" && failClosedClasses.has(rateClass)) {
      return unavailableResponse();
    }
    try {
      const fallback = await evaluateRateLimit({
        rateClass,
        identity,
        authenticated: Boolean(userId),
        backend: processMemoryBackend,
        nowMs: options.nowMs,
        buckets: selectedBuckets,
      });
      return fallback.allowed ? null : retryResponse(fallback.retryAfterSeconds);
    } catch {
      return unavailableResponse();
    }
  }
}

export function resetProcessRateLimitsForTests() {
  processMemoryBackend.clear();
}
