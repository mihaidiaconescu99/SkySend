import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enforceRateLimit,
  evaluateRateLimit,
  getTrustedClientIp,
  MemoryRateLimitBackend,
  type RateLimitBackend,
} from "@/lib/api/rate-limit";

const smallWindow = [{ name: "test", limit: 3, windowSeconds: 10 }] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("application rate limiting", () => {
  it("allows the configured requests, returns 429 with Retry-After, then resets", async () => {
    const backend = new MemoryRateLimitBackend();
    const request = new Request("http://localhost/api/test");

    for (let index = 0; index < 3; index += 1) {
      const response = await enforceRateLimit(request, "assistant", {
        backend,
        buckets: smallWindow,
        nowMs: 1_000,
        userId: "user-a",
        environment: "development",
      });
      expect(response).toBeNull();
    }

    const blocked = await enforceRateLimit(request, "assistant", {
      backend,
      buckets: smallWindow,
      nowMs: 1_000,
      userId: "user-a",
      environment: "development",
    });
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("10");
    expect(await blocked?.json()).toEqual({
      error: "rate_limited",
      retryAfter: 10,
    });

    const reset = await enforceRateLimit(request, "assistant", {
      backend,
      buckets: smallWindow,
      nowMs: 11_001,
      userId: "user-a",
      environment: "development",
    });
    expect(reset).toBeNull();
  });

  it("keeps counters separate between identities", async () => {
    const backend = new MemoryRateLimitBackend();
    for (let index = 0; index < 3; index += 1) {
      await evaluateRateLimit({
        rateClass: "assistant",
        identity: "user:a",
        authenticated: true,
        backend,
        buckets: smallWindow,
        nowMs: 5_000,
      });
    }

    const firstForSecondIdentity = await evaluateRateLimit({
      rateClass: "assistant",
      identity: "user:b",
      authenticated: true,
      backend,
      buckets: smallWindow,
      nowMs: 5_000,
    });
    expect(firstForSecondIdentity.allowed).toBe(true);
  });

  it("fails closed for an expensive production class when the backend fails", async () => {
    vi.stubEnv("RATE_LIMIT_HMAC_SECRET", "x".repeat(32));
    const failingBackend: RateLimitBackend = {
      consume: vi.fn().mockRejectedValue(new Error("database_unavailable")),
    };
    const response = await enforceRateLimit(
      new Request("https://skysend.website/api/ai/assistant"),
      "assistant",
      {
        backend: failingBackend,
        userId: "user-a",
        environment: "production",
      },
    );
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Retry-After")).toBe("5");
  });

  it("does not trust a client-supplied X-Forwarded-For in production", () => {
    const request = new Request("https://skysend.website/api/test", {
      headers: {
        host: "skysend.website",
        "x-forwarded-for": "203.0.113.10, 198.51.100.7",
      },
    });
    expect(getTrustedClientIp(request, "production")).toBeNull();
  });

  it("accepts the Cloudflare address only on the canonical proxied host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skysend.website");
    const request = new Request("https://skysend.website/api/test", {
      headers: {
        host: "skysend.website",
        "cf-ray": "test-ray",
        "cf-connecting-ip": "203.0.113.10",
      },
    });
    expect(getTrustedClientIp(request, "production")).toBe("203.0.113.10");
  });
});
