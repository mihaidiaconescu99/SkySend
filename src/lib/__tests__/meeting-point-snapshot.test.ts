import { describe, expect, it } from "vitest";
import { createCompleteHandoffSnapshot } from "@/lib/meeting-point-snapshot";
import type {
  CreateDeliveryMeetingPointPayload,
  CreateDeliveryPayload,
} from "@/types/create-delivery";

function point(
  id: string,
  latitude: number,
  longitude: number,
): CreateDeliveryMeetingPointPayload {
  return {
    id,
    label: id,
    type: "street_side",
    description: "Punct disponibil",
    location: { latitude, longitude },
    eligibilityState: "eligible",
    recommendationState: id.includes("selected") ? "recommended" : "alternative",
    smartScore: 80,
    distanceFromOriginMeters: 10,
  };
}

describe("meeting point snapshot", () => {
  it("keeps the selected point first and completes both phases to four unique points", () => {
    const selectedPickup = point("pickup-selected", 44.856, 24.875);
    const selectedDropoff = point("dropoff-selected", 44.86, 24.88);
    const payload = {
      pickupAddress: {
        formattedAddress: "Pickup",
        location: selectedPickup.location,
      },
      dropoffAddress: {
        formattedAddress: "Dropoff",
        location: selectedDropoff.location,
      },
      selectedPickupPoint: selectedPickup,
      selectedDropoffPoint: selectedDropoff,
      pickupMeetingPoints: [
        selectedPickup,
        point("pickup-second", 44.8561, 24.8751),
      ],
      dropoffMeetingPoints: [selectedDropoff],
    } as CreateDeliveryPayload;

    const snapshot = createCompleteHandoffSnapshot(payload);

    expect(snapshot.pickup).toHaveLength(4);
    expect(snapshot.dropoff).toHaveLength(4);
    expect(snapshot.pickup[0].id).toBe(selectedPickup.id);
    expect(snapshot.dropoff[0].id).toBe(selectedDropoff.id);
    expect(new Set(snapshot.pickup.map((candidate) => candidate.id)).size).toBe(4);
    expect(new Set(snapshot.dropoff.map((candidate) => candidate.id)).size).toBe(4);
  });
});
