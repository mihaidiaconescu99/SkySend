import { describe, expect, it, vi } from "vitest";

const handoffMock = vi.hoisted(() => ({
  fetchGeoapifyPlacesHandoffPoints: vi.fn().mockRejectedValue(new Error("timeout")),
  fetchGeoapifyDetailsHandoffPoints: vi.fn().mockRejectedValue(new Error("timeout")),
  fetchOverpassHandoffPoints: vi.fn().mockRejectedValue(new Error("timeout")),
  buildHandoffPointResponse: vi.fn().mockReturnValue({
    points: [],
    source: "inferred",
  }),
  enrichHandoffPointNamesWithGeoapify: vi.fn().mockImplementation(
    async (response: unknown) => response,
  ),
}));

vi.mock("@/lib/handoff-points", () => handoffMock);

const { POST } = await import("@/app/api/handoff-points/route");

describe("POST /api/handoff-points degradation", () => {
  it("returns a controlled fallback when every map provider fails", async () => {
    const response = await POST(
      new Request("http://localhost/api/handoff-points", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          field: "pickup",
          address: {
            formattedAddress: "Strada Republicii 1, Pitesti",
            location: { latitude: 44.8565, longitude: 24.8692 },
            city: "Pitesti",
            county: "Arges",
            country: "Romania",
            postalCode: "110014",
          },
          isAddressEligible: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      points: [],
      source: "inferred",
    });
    expect(handoffMock.buildHandoffPointResponse).toHaveBeenCalledWith(
      expect.any(Object),
      [],
    );
  });
});
