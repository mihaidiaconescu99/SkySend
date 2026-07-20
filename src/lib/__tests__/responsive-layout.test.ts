import { describe, expect, it } from "vitest";
import { isCompactViewport } from "@/lib/responsive-layout";

describe("responsive layout classification", () => {
  it.each([
    [320, 568],
    [390, 844],
    [932, 430],
    [800, 1280],
    [1024, 1366],
  ])("uses compact layout at %ix%i", (width, height) => {
    expect(isCompactViewport({ width, height })).toBe(true);
  });

  it.each([
    [1280, 800],
    [1366, 1024],
    [1280, 720],
    [1440, 900],
  ])("uses expanded layout at %ix%i", (width, height) => {
    expect(isCompactViewport({ width, height })).toBe(false);
  });

  it("keeps a short fine-pointer laptop expanded", () => {
    expect(
      isCompactViewport({ width: 1024, height: 600, coarsePointer: false }),
    ).toBe(false);
  });
});
