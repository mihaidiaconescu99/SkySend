import { describe, expect, it } from "vitest";
import {
  getFailureCodeForTimerKind,
  getMissionJourneyProgress,
  premiumFailureContent,
} from "@/lib/mission-progress";

describe("premium mission progress", () => {
  it("uses the 40/10/40/10 journey weighting", () => {
    expect(getMissionJourneyProgress("en_route_to_pickup", 0.5)).toBe(20);
    expect(getMissionJourneyProgress("awaiting_sender_position_confirmation", 1)).toBe(40);
    expect(getMissionJourneyProgress("awaiting_parcel_load", 0)).toBe(45);
    expect(getMissionJourneyProgress("parcel_secured", 0)).toBe(50);
    expect(getMissionJourneyProgress("en_route_to_dropoff", 0.5)).toBe(70);
    expect(getMissionJourneyProgress("awaiting_recipient_position_confirmation", 1)).toBe(90);
    expect(getMissionJourneyProgress("awaiting_parcel_collection", 0)).toBe(95);
    expect(getMissionJourneyProgress("mission_closed", 1)).toBe(100);
  });

  it("clamps flight progress", () => {
    expect(getMissionJourneyProgress("en_route_to_pickup", -2)).toBe(0);
    expect(getMissionJourneyProgress("en_route_to_dropoff", 4)).toBe(90);
  });
});

describe("premium failure policy", () => {
  it("maps all four timer kinds to distinct reasons", () => {
    expect(getFailureCodeForTimerKind("pickup_meeting_point")).toBe("pickup_confirmation_timeout");
    expect(getFailureCodeForTimerKind("parcel_load")).toBe("pickup_load_timeout");
    expect(getFailureCodeForTimerKind("dropoff_meeting_point")).toBe("dropoff_confirmation_timeout");
    expect(getFailureCodeForTimerKind("parcel_collection")).toBe("dropoff_collection_timeout");
  });

  it("only refunds when every meeting point was rejected", () => {
    expect(premiumFailureContent.pickup_confirmation_timeout.refundEligible).toBe(false);
    expect(premiumFailureContent.pickup_load_timeout.refundEligible).toBe(false);
    expect(premiumFailureContent.dropoff_confirmation_timeout.refundEligible).toBe(false);
    expect(premiumFailureContent.dropoff_collection_timeout.refundEligible).toBe(false);
    expect(premiumFailureContent.no_suitable_pickup_meeting_point.refundEligible).toBe(true);
    expect(premiumFailureContent.no_suitable_dropoff_meeting_point.refundEligible).toBe(true);
  });
});
