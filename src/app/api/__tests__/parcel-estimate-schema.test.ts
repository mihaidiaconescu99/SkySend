import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai", () => ({
  estimateParcelForDispatch: vi.fn(),
}));

const { parcelEstimateRequestSchema } = await import(
  "@/lib/ai/parcel-estimate-route"
);

describe("parcel-estimate POST schema", () => {
  it("accepts a minimal valid request with just `contents`", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "două cărți într-un pachet",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated request with advancedDetails", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contentDescription: "două cărți într-un pachet",
      packaging: "boxed",
      approximateSize: "small",
      advancedDetails: {
        declaredWeightKg: 1.4,
        declaredDimensionsCm: { lengthCm: 25, widthCm: 18, heightCm: 8 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts at most two Parcel AI image identifiers", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "un produs fotografiat",
      parcelAiImageIds: [
        "27be7fcd-7f3a-43b6-b439-76d830aa6b7e",
        "c1f1a45c-bb80-47f8-9f1b-e2bdb1de684d",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than two Parcel AI images", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "un produs fotografiat",
      parcelAiImageIds: [
        "27be7fcd-7f3a-43b6-b439-76d830aa6b7e",
        "c1f1a45c-bb80-47f8-9f1b-e2bdb1de684d",
        "e4ac6e41-59fe-40d6-bc37-c466fc1c8bc1",
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a request with no description at all", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      packaging: "boxed",
      approximateSize: "small",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative declared weight", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "ceva",
      advancedDetails: { declaredWeightKg: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects declared dimensions with a zero side", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "ceva",
      advancedDetails: {
        declaredDimensionsCm: { lengthCm: 25, widthCm: 0, heightCm: 8 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown packaging values", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "ceva",
      packaging: "wooden_crate",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contents longer than 2000 chars", () => {
    const result = parcelEstimateRequestSchema.safeParse({
      contents: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects HTML, JavaScript schemes, unknown fields, and non-finite values", () => {
    for (const contents of [
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
    ]) {
      expect(parcelEstimateRequestSchema.safeParse({ contents }).success)
        .toBe(false);
    }
    expect(parcelEstimateRequestSchema.safeParse({
      contents: "colet valid",
      role: "admin",
    }).success).toBe(false);
    for (const declaredWeightKg of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(parcelEstimateRequestSchema.safeParse({
        contents: "colet valid",
        advancedDetails: { declaredWeightKg },
      }).success).toBe(false);
    }
  });
});
