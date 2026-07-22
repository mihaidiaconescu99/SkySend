import { describe, expect, it } from "vitest";
import { getHeroFrameIndex } from "@/components/storytelling/scroll-frame-sequence";

describe("getHeroFrameIndex", () => {
  it("preserves the original frame pacing across the shorter 16-screen chapter", () => {
    expect(getHeroFrameIndex(0, 241)).toBe(0);
    expect(getHeroFrameIndex(0.62425, 241)).toBe(143);
    expect(getHeroFrameIndex(0.8965, 241)).toBe(240);
    expect(getHeroFrameIndex(1, 241)).toBe(240);
  });

  it("clamps progress outside the chapter", () => {
    expect(getHeroFrameIndex(-1, 241)).toBe(0);
    expect(getHeroFrameIndex(2, 241)).toBe(240);
  });
});
