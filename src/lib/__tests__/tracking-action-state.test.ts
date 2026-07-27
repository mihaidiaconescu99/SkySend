import { describe, expect, it } from "vitest";
import { getAlreadyAppliedTrackingActionPhase } from "@/lib/tracking-action-state";

describe("tracking action idempotency", () => {
  it("recognizes position confirmations that already reached their next state", () => {
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "confirm_position",
        "awaiting_parcel_load",
      ),
    ).toBe("pickup");
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "confirm_position",
        "awaiting_parcel_collection",
      ),
    ).toBe("dropoff");
  });

  it("recognizes reroutes that are already in flight", () => {
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "next_point",
        "en_route_to_pickup",
      ),
    ).toBe("pickup");
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "next_point",
        "en_route_to_dropoff",
      ),
    ).toBe("dropoff");
  });

  it("does not treat an unrelated state as an applied action", () => {
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "confirm_position",
        "en_route_to_pickup",
      ),
    ).toBeNull();
    expect(
      getAlreadyAppliedTrackingActionPhase(
        "parcel_loaded",
        "en_route_to_dropoff",
        false,
      ),
    ).toBeNull();
  });
});
