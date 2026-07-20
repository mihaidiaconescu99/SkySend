export type HowJourneyPhase = {
  start: number;
  duration: number;
  end: number;
};

function phase(start: number, duration: number): HowJourneyPhase {
  return { start, duration, end: start + duration };
}

export const HOW_JOURNEY_TIMELINE = {
  pickupFirst: phase(0, 6),
  pickupSecond: phase(6, 6),
  flightEntrance: phase(12, 3),
  flight: phase(15, 7),
  dropoffEntrance: phase(22, 3),
  dropoff: phase(25, 8),
  finalFade: phase(33, 4),
} as const;

export const HOW_JOURNEY_TOTAL_SCREENS = HOW_JOURNEY_TIMELINE.finalFade.end;
export const HOW_JOURNEY_CHAPTER_SCREENS = HOW_JOURNEY_TOTAL_SCREENS + 1;

export function getJourneyPhaseProgress(viewport: number, phaseRange: HowJourneyPhase) {
  return Math.min(1, Math.max(0, (viewport - phaseRange.start) / phaseRange.duration));
}

export function getJourneyViewport(progress: number) {
  return progress * HOW_JOURNEY_TOTAL_SCREENS;
}
