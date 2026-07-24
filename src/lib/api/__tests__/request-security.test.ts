import { describe, expect, it } from "vitest";
import {
  bearerSecretMatches,
  evaluateSameOriginRequest,
} from "@/lib/api/request-security";

function mutation(headers: HeadersInit = {}) {
  return new Request("https://app.skysend.test/api/profile", {
    method: "POST",
    headers,
  });
}

describe("same-origin mutation guard", () => {
  it("allows the configured canonical origin", () => {
    expect(
      evaluateSameOriginRequest(
        mutation({
          Origin: "https://app.skysend.test",
          "Sec-Fetch-Site": "same-origin",
        }),
        {
          canonicalOrigin: "https://app.skysend.test",
          environment: "production",
        },
      ),
    ).toEqual({ ok: true, origin: "https://app.skysend.test" });
  });

  it("rejects an untrusted or cross-site origin", () => {
    expect(
      evaluateSameOriginRequest(
        mutation({
          Origin: "https://evil.example",
          "Sec-Fetch-Site": "cross-site",
        }),
        {
          canonicalOrigin: "https://app.skysend.test",
          environment: "production",
        },
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("fails closed for a production browser mutation without Origin", () => {
    expect(
      evaluateSameOriginRequest(
        mutation({
          Cookie: "__session=test",
          "Sec-Fetch-Site": "same-origin",
        }),
        {
          canonicalOrigin: "https://app.skysend.test",
          environment: "production",
        },
      ),
    ).toEqual({
      ok: false,
      status: 403,
      error: "request_origin_required",
    });
  });

  it("permits local origins only outside production", () => {
    const request = mutation({ Origin: "http://localhost:3000" });
    expect(
      evaluateSameOriginRequest(request, {
        canonicalOrigin: "https://app.skysend.test",
        environment: "development",
      }).ok,
    ).toBe(true);
    expect(
      evaluateSameOriginRequest(request, {
        canonicalOrigin: "https://app.skysend.test",
        environment: "production",
      }).ok,
    ).toBe(false);
  });
});

describe("Bearer secret verification", () => {
  it("requires an exact configured secret", () => {
    expect(bearerSecretMatches("Bearer expected-value", "expected-value")).toBe(true);
    expect(bearerSecretMatches("Bearer wrong-value", "expected-value")).toBe(false);
    expect(bearerSecretMatches("Bearer anything", "")).toBe(false);
  });
});
