import { describe, expect, it } from "vitest";
import { getDistanceBasedDeliveryEtaWindow } from "@/lib/delivery-eta";

describe("getDistanceBasedDeliveryEtaWindow", () => {
  it("scales the estimate with the route distance", () => {
    expect(getDistanceBasedDeliveryEtaWindow(1)).toEqual({ min: 2, max: 4 });
    expect(getDistanceBasedDeliveryEtaWindow(5)).toEqual({ min: 5, max: 7 });
  });

  it("never exceeds ten minutes", () => {
    expect(getDistanceBasedDeliveryEtaWindow(20)).toEqual({ min: 8, max: 10 });
  });
});
