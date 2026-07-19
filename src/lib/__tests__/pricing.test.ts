import { describe, it, expect } from "vitest";

import {
  calculateSkySendPricing,
  isValidPricingSnapshot,
} from "@/lib/pricing";
import type {
  PricingDeliveryConfigurationInput,
  SkySendPricingInput,
  SkySendPricingResult,
} from "@/types/pricing";

const EFFECTIVE_BASE_MINOR = 990;
const EFFECTIVE_PER_KM_MINOR = 220;

function buildInput(
  overrides: Partial<SkySendPricingInput> = {},
): SkySendPricingInput {
  return {
    distanceKm: 1,
    selectedDroneId: "medium_standard",
    dispatchTiming: "standard",
    routeComplexity: "standard",
    ...overrides,
  };
}

function buildConfiguration(
  overrides: Partial<PricingDeliveryConfigurationInput> = {},
): PricingDeliveryConfigurationInput {
  return {
    id: "aer_express",
    platform: "aer",
    moduleName: "Aer Express",
    mappedDroneClass: "medium_standard",
    pricingMultipliers: {
      baseMultiplier: 1,
      perKmMultiplier: 1,
    },
    temperatureProtection: "none",
    securityLevel: "standard",
    shockProtection: "standard",
    ...overrides,
  };
}

describe("calculateSkySendPricing", () => {
  describe("base distance calculation", () => {
    it("computes total as baseFee + distanceFee for 1 km on a standard drone with standard dispatch", () => {
      const result = calculateSkySendPricing(buildInput({ distanceKm: 1 }));

      expect(result.baseFee.amountMinor).toBe(EFFECTIVE_BASE_MINOR);
      expect(result.distanceFee.amountMinor).toBe(EFFECTIVE_PER_KM_MINOR);
      expect(result.total.amountMinor).toBe(
        EFFECTIVE_BASE_MINOR + EFFECTIVE_PER_KM_MINOR,
      );
      expect(result.currency).toBe("RON");
      expect(result.version).toBe("skysend-pricing-v1");
    });

    it("never returns a total below the 100 minor-unit minimum, even at 0 km", () => {
      const result = calculateSkySendPricing(buildInput({ distanceKm: 0 }));

      expect(result.distanceFee.amountMinor).toBe(0);
      expect(result.total.amountMinor).toBeGreaterThanOrEqual(100);
    });

    it("scales the distance fee linearly for long routes (50 km)", () => {
      const result = calculateSkySendPricing(buildInput({ distanceKm: 50 }));

      expect(result.distanceFee.amountMinor).toBe(50 * EFFECTIVE_PER_KM_MINOR);
      expect(result.total.amountMinor).toBe(
        EFFECTIVE_BASE_MINOR + 50 * EFFECTIVE_PER_KM_MINOR,
      );
    });
  });

  describe("dispatch timing multipliers", () => {
    const baseSubtotal = EFFECTIVE_BASE_MINOR + EFFECTIVE_PER_KM_MINOR;

    it("applies multiplier 1.0 for standard dispatch (no adjustment)", () => {
      const result = calculateSkySendPricing(
        buildInput({ dispatchTiming: "standard" }),
      );

      expect(result.dispatchTimingAdjustment.amountMinor).toBe(0);
      expect(result.total.amountMinor).toBe(baseSubtotal);
    });

    it("applies multiplier 1.22 for priority dispatch", () => {
      const result = calculateSkySendPricing(
        buildInput({ dispatchTiming: "priority" }),
      );

      const expectedAdjustment = Math.round(baseSubtotal * 0.22);
      expect(result.dispatchTimingAdjustment.amountMinor).toBe(
        expectedAdjustment,
      );
      expect(result.total.amountMinor).toBe(baseSubtotal + expectedAdjustment);
    });

    it("applies multiplier 0.96 for scheduled dispatch when scheduledAt is provided", () => {
      const result = calculateSkySendPricing(
        buildInput({
          dispatchTiming: "scheduled",
          scheduledAt: "2026-06-01T10:00:00Z",
        }),
      );

      const expectedAdjustment = Math.round(baseSubtotal * (0.96 - 1));
      expect(result.dispatchTimingAdjustment.amountMinor).toBe(0);
      expect(result.scheduledAdjustment.amountMinor).toBe(expectedAdjustment);
      expect(result.total.amountMinor).toBe(baseSubtotal + expectedAdjustment);
    });

    it("applies multiplier 1.45 for critical dispatch", () => {
      const result = calculateSkySendPricing(
        buildInput({ dispatchTiming: "critical" }),
      );

      const expectedAdjustment = Math.round(baseSubtotal * 0.45);
      expect(result.dispatchTimingAdjustment.amountMinor).toBe(
        expectedAdjustment,
      );
      expect(result.total.amountMinor).toBe(baseSubtotal + expectedAdjustment);
    });
  });

  describe("weight surcharges", () => {
    it("adds 0 surcharge for parcels at or below 3 kg", () => {
      const result = calculateSkySendPricing(buildInput({ weightKg: 2.5 }));

      expect(result.weightSurcharge.amountMinor).toBe(0);
    });

    it("adds 700 surcharge for parcels above 3 kg and up to 5 kg", () => {
      const result = calculateSkySendPricing(buildInput({ weightKg: 4 }));

      expect(result.weightSurcharge.amountMinor).toBe(700);
    });

    it("adds 1200 surcharge for parcels above 5 kg", () => {
      const result = calculateSkySendPricing(buildInput({ weightKg: 6 }));

      expect(result.weightSurcharge.amountMinor).toBe(1200);
    });
  });

  describe("fragile handling surcharges", () => {
    it("adds 0 surcharge for low fragility level", () => {
      const result = calculateSkySendPricing(
        buildInput({ fragilityLevel: "low" }),
      );

      expect(result.fragileHandlingSurcharge.amountMinor).toBe(0);
    });

    it("adds 300 surcharge for moderate fragility level", () => {
      const result = calculateSkySendPricing(
        buildInput({ fragilityLevel: "moderate" }),
      );

      expect(result.fragileHandlingSurcharge.amountMinor).toBe(300);
    });

    it("adds 650 surcharge for high fragility level", () => {
      const result = calculateSkySendPricing(
        buildInput({ fragilityLevel: "high" }),
      );

      expect(result.fragileHandlingSurcharge.amountMinor).toBe(650);
    });
  });

  describe("thermal protection surcharges", () => {
    it("adds 0 surcharge when temperatureProtection is none", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            temperatureProtection: "none",
          }),
        }),
      );

      expect(result.thermalHandlingSurcharge?.amountMinor).toBe(0);
    });

    it("adds 250 surcharge for passive_insulated temperature protection", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            temperatureProtection: "passive_insulated",
          }),
        }),
      );

      expect(result.thermalHandlingSurcharge?.amountMinor).toBe(250);
    });

    it("adds 550 surcharge for active_thermal temperature protection", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            temperatureProtection: "active_thermal",
          }),
        }),
      );

      expect(result.thermalHandlingSurcharge?.amountMinor).toBe(550);
    });
  });

  describe("secure handling surcharges", () => {
    it("adds 0 surcharge for standard security level", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            securityLevel: "standard",
          }),
        }),
      );

      expect(result.secureHandlingSurcharge?.amountMinor).toBe(0);
    });

    it("adds 350 surcharge for secure security level", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            securityLevel: "secure",
          }),
        }),
      );

      expect(result.secureHandlingSurcharge?.amountMinor).toBe(350);
    });

    it("adds 800 surcharge for secure_plus security level", () => {
      const result = calculateSkySendPricing(
        buildInput({
          deliveryConfiguration: buildConfiguration({
            securityLevel: "secure_plus",
          }),
        }),
      );

      expect(result.secureHandlingSurcharge?.amountMinor).toBe(800);
    });
  });

  describe("oversize surcharge", () => {
    it("adds 0 surcharge when dimensions are within the 35x28x18 reference envelope", () => {
      const result = calculateSkySendPricing(
        buildInput({
          dimensionsCm: { lengthCm: 35, widthCm: 28, heightCm: 18 },
        }),
      );

      expect(result.routeComplexityAdjustment.amountMinor).toBe(0);
    });

    it("adds 500 surcharge when any dimension exceeds the 35x28x18 envelope", () => {
      const result = calculateSkySendPricing(
        buildInput({
          dimensionsCm: { lengthCm: 40, widthCm: 30, heightCm: 20 },
        }),
      );

      expect(result.routeComplexityAdjustment.amountMinor).toBe(500);
    });
  });

  describe("drone class multipliers", () => {
    it("applies the drone's baseMultiplier and perKmMultiplier when no deliveryConfiguration is provided", () => {

      const result = calculateSkySendPricing(
        buildInput({ distanceKm: 1, selectedDroneId: "light_swift" }),
      );

      const expectedConfigAdjusted = Math.round(
        EFFECTIVE_BASE_MINOR * 0.92 + EFFECTIVE_PER_KM_MINOR * 0.94,
      );
      const expectedAdjustment =
        expectedConfigAdjusted - (EFFECTIVE_BASE_MINOR + EFFECTIVE_PER_KM_MINOR);

      expect(result.droneModelAdjustment.amountMinor).toBe(expectedAdjustment);
      expect(result.total.amountMinor).toBe(expectedConfigAdjusted);
    });

    it("uses deliveryConfiguration multipliers (e.g. aer_express) over the drone defaults", () => {
      const result = calculateSkySendPricing(
        buildInput({
          distanceKm: 1,
          selectedDroneId: "medium_standard",
          deliveryConfiguration: buildConfiguration({
            id: "aer_express",
            pricingMultipliers: {
              baseMultiplier: 0.9,
              perKmMultiplier: 1.1,
            },
          }),
        }),
      );

      const expectedConfigAdjusted = Math.round(
        EFFECTIVE_BASE_MINOR * 0.9 + EFFECTIVE_PER_KM_MINOR * 1.1,
      );
      const expectedAdjustment =
        expectedConfigAdjusted - (EFFECTIVE_BASE_MINOR + EFFECTIVE_PER_KM_MINOR);

      expect(result.deliveryConfigurationAdjustment?.amountMinor).toBe(
        expectedAdjustment,
      );
      expect(result.total.amountMinor).toBe(expectedConfigAdjusted);
    });
  });
});

describe("isValidPricingSnapshot", () => {
  it("returns true for a freshly computed pricing result", () => {
    const result = calculateSkySendPricing(buildInput());

    expect(isValidPricingSnapshot(result)).toBe(true);
  });

  it("returns false when the version is not skysend-pricing-v1", () => {
    const result = calculateSkySendPricing(buildInput());
    const invalid = { ...result, version: "skysend-pricing-v2" } as unknown;

    expect(isValidPricingSnapshot(invalid)).toBe(false);
  });

  it("returns false when total.amountMinor is below 100", () => {
    const result: SkySendPricingResult = calculateSkySendPricing(buildInput());
    const invalid = {
      ...result,
      total: { amountMinor: 50, currency: result.currency },
    };

    expect(isValidPricingSnapshot(invalid)).toBe(false);
  });
});
