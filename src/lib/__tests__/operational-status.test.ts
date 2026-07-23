import { describe, expect, it } from "vitest";
import { resolveEffectivePlatformStatus } from "@/lib/operational-status";

describe("operational status precedence", () => {
  const now = new Date("2026-07-22T10:00:00Z");

  it("gives manual maintenance absolute priority", () => {
    expect(resolveEffectivePlatformStatus({ manualStatus: "maintenance", weatherLevel: "suspended", overrideExpiresAt: "2026-07-23T10:00:00Z", overrideCancelledAt: null, now })).toBe("maintenance");
  });

  it("allows a non-expired Active override over weather suspension", () => {
    expect(resolveEffectivePlatformStatus({ manualStatus: "active", weatherLevel: "suspended", overrideExpiresAt: "2026-07-23T10:00:00Z", overrideCancelledAt: null, now })).toBe("active");
  });

  it("expires the override using server time", () => {
    expect(resolveEffectivePlatformStatus({ manualStatus: "active", weatherLevel: "suspended", overrideExpiresAt: "2026-07-22T10:00:00Z", overrideCancelledAt: null, now })).toBe("suspended");
  });
});
