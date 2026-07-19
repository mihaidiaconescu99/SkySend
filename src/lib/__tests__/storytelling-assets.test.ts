import { describe, expect, it } from "vitest";
import {
  createStorytellingRoot,
  storytellingAssets,
  storytellingRelease,
} from "@/lib/storytelling-assets";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}

describe("storytelling R2 release", () => {
  it("builds a versioned Cloudflare media root", () => {
    expect(createStorytellingRoot("https://media.skysend.website/")).toBe(
      `https://media.skysend.website/releases/${storytellingRelease.releaseId}/assets/storytelling`,
    );
  });

  it("supports the explicit local processing override", () => {
    expect(createStorytellingRoot("")).toBe("/assets/storytelling");
  });

  it("keeps every storytelling media URL on the active release", () => {
    const releaseRoot = createStorytellingRoot();
    const urls = collectStrings(storytellingAssets).filter((value) => value.includes("/"));
    expect(urls.length).toBeGreaterThan(20);
    expect(urls.every((url) => url.startsWith(`${releaseRoot}/`))).toBe(true);
  });

  it("preserves the frame counts used by scroll animations", () => {
    expect(storytellingAssets.hero.desktop.frameCount).toBe(241);
    expect(storytellingAssets.hero.mobile.frameCount).toBe(241);
    expect(storytellingAssets.editorial.sequence.desktop.frameCount).toBe(139);
    expect(storytellingAssets.editorial.sequence.mobile.frameCount).toBe(139);
  });

  it("uses the same full-quality tutorial video for desktop and mobile scrub", () => {
    const tutorial = storytellingAssets.howItWorks.tutorial;
    expect(tutorial.desktop).toBe(tutorial.mobile);
    expect(tutorial.desktop).toContain("/runtime/how-it-works/mobile-tutorial.mp4");
    expect(tutorial.posterDesktop).toBe(tutorial.posterMobile);
  });
});
