import { describe, expect, it } from "vitest";
import {
  getJourneyPhaseProgress,
  HOW_JOURNEY_CHAPTER_SCREENS,
  HOW_JOURNEY_TIMELINE,
  HOW_JOURNEY_TOTAL_SCREENS,
} from "../how-it-works-journey-timeline";

describe("how-it-works journey timeline", () => {
  it("keeps the approved phase durations and the 37-screen total", () => {
    expect(HOW_JOURNEY_TIMELINE.pickupFirst.duration).toBe(6);
    expect(HOW_JOURNEY_TIMELINE.pickupSecond.duration).toBe(6);
    expect(HOW_JOURNEY_TIMELINE.flightEntrance.duration).toBe(3);
    expect(HOW_JOURNEY_TIMELINE.flight.duration).toBe(7);
    expect(HOW_JOURNEY_TIMELINE.dropoffEntrance.duration).toBe(3);
    expect(HOW_JOURNEY_TIMELINE.dropoff.duration).toBe(8);
    expect(HOW_JOURNEY_TIMELINE.finalFade.duration).toBe(4);
    expect(HOW_JOURNEY_TOTAL_SCREENS).toBe(37);
    expect(HOW_JOURNEY_CHAPTER_SCREENS).toBe(38);
  });

  it("places every phase directly after the previous phase", () => {
    const phases = Object.values(HOW_JOURNEY_TIMELINE);
    phases.slice(1).forEach((current, index) => {
      expect(current.start).toBe(phases[index].end);
    });
  });

  it("clamps local phase progress before and after its range", () => {
    const range = HOW_JOURNEY_TIMELINE.dropoff;
    expect(getJourneyPhaseProgress(range.start - 1, range)).toBe(0);
    expect(getJourneyPhaseProgress(range.start, range)).toBe(0);
    expect(getJourneyPhaseProgress(range.start + range.duration / 2, range)).toBe(0.5);
    expect(getJourneyPhaseProgress(range.end, range)).toBe(1);
    expect(getJourneyPhaseProgress(range.end + 1, range)).toBe(1);
  });
});
