import { describe, it, expect } from "vitest";

import { handoffPointRequestSchema } from "@/lib/handoff-point-input-schema";

describe("handoff-points POST schema", () => {
  const validPayload = {
    field: "pickup",
    address: {
      formattedAddress: "Strada Republicii 1, Pitești",
      location: { latitude: 44.8565, longitude: 24.8692 },
      city: "Pitești",
      county: "Argeș",
      country: "România",
      postalCode: "110014",
    },
    isAddressEligible: true,
  };

  it("accepts a well-formed handoff request inside Romania", () => {
    const result = handoffPointRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects coordinates outside Romania (defensive geographic clamp)", () => {
    const result = handoffPointRequestSchema.safeParse({
      ...validPayload,
      address: {
        ...validPayload.address,
        location: { latitude: 48.8566, longitude: 2.3522 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown field values", () => {
    const result = handoffPointRequestSchema.safeParse({
      ...validPayload,
      field: "warehouse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects requests with a non-boolean isAddressEligible", () => {
    const result = handoffPointRequestSchema.safeParse({
      ...validPayload,
      isAddressEligible: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payloads missing a formattedAddress", () => {
    const result = handoffPointRequestSchema.safeParse({
      ...validPayload,
      address: { ...validPayload.address, formattedAddress: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsafe text, unknown properties, and non-finite coordinates", () => {
    expect(handoffPointRequestSchema.safeParse({
      ...validPayload,
      address: {
        ...validPayload.address,
        formattedAddress: "<script>alert(1)</script>",
      },
    }).success).toBe(false);
    expect(handoffPointRequestSchema.safeParse({
      ...validPayload,
      profileId: "00000000-0000-4000-8000-000000000001",
    }).success).toBe(false);
    for (const latitude of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(handoffPointRequestSchema.safeParse({
        ...validPayload,
        address: {
          ...validPayload.address,
          location: { ...validPayload.address.location, latitude },
        },
      }).success).toBe(false);
    }
  });
});
