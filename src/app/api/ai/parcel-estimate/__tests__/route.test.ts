import { describe, expect, it, vi } from "vitest";

const aiMock = vi.hoisted(() => ({
  estimateParcelForDispatch: vi.fn().mockRejectedValue(
    new Error("upstream_timeout"),
  ),
}));

vi.mock("@/lib/ai", () => aiMock);

const { POST } = await import("@/app/api/ai/parcel-estimate/route");

describe("POST /api/ai/parcel-estimate upstream failure", () => {
  it("returns a controlled 503 instead of crashing", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/parcel-estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: "Cutie cu accesorii electronice",
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "estimator_unavailable",
    });
  });
});
