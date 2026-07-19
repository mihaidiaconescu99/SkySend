import type { EcoMetric } from "@/types/entities";
import type {
  EcoEstimationInput,
  EcoMetricLike,
  EcoScoreBand,
  EcoScoreSnapshot,
  MonthlyEcoAggregate,
} from "@/types/eco-helpers";

const ROAD_EMISSION_FACTOR_GRAMS_PER_KM = 82;
const ELECTRIC_EMISSION_FACTOR_GRAMS_PER_KWH = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function estimateCo2Saved({
  roadDistanceKm,
  droneEnergyUseKwh,
  roadEmissionFactorGramsPerKm = ROAD_EMISSION_FACTOR_GRAMS_PER_KM,
  electricEmissionFactorGramsPerKwh = ELECTRIC_EMISSION_FACTOR_GRAMS_PER_KWH,
}: EcoEstimationInput) {
  const avoidedRoadEmissions = roadDistanceKm * roadEmissionFactorGramsPerKm;
  const droneEnergyEmissions = droneEnergyUseKwh * electricEmissionFactorGramsPerKwh;

  return Math.max(0, Math.round(avoidedRoadEmissions - droneEnergyEmissions));
}

export function estimateRoadDistanceAvoided(roadDistanceKm: number) {
  return roundTo(Math.max(0, roadDistanceKm), 1);
}

export function calculateEcoScore(metric: Pick<
  EcoMetricLike,
  "estimatedCo2SavedGrams" | "estimatedRoadDistanceSavedKm" | "estimatedEnergyUseKwh"
>): EcoScoreSnapshot {
  const co2Component = clamp(metric.estimatedCo2SavedGrams / 12, 0, 55);
  const distanceComponent = clamp(metric.estimatedRoadDistanceSavedKm * 3.4, 0, 30);
  const energyEfficiencyComponent = clamp(
    (metric.estimatedCo2SavedGrams / Math.max(metric.estimatedEnergyUseKwh, 0.2)) / 14,
    0,
    15,
  );

  const score = Math.round(clamp(co2Component + distanceComponent + energyEfficiencyComponent, 0, 100));

  let band: EcoScoreBand = "low";
  let label = "Light estimated impact";

  if (score >= 85) {
    band = "excellent";
    label = "Excellent estimated eco impact";
  } else if (score >= 65) {
    band = "strong";
    label = "Strong estimated eco impact";
  } else if (score >= 40) {
    band = "moderate";
    label = "Moderate estimated eco impact";
  }

  return {
    score,
    band,
    label,
  };
}

export function aggregateEcoMetricsByMonth(
  metrics: readonly EcoMetricLike[],
): MonthlyEcoAggregate[] {
  const grouped = new Map<string, MonthlyEcoAggregate>();

  for (const metric of metrics) {
    const monthKey = metric.createdAt.slice(0, 7);
    const current = grouped.get(monthKey);
    const ecoScore = calculateEcoScore(metric).score;

    if (current) {
      current.orderCount += 1;
      current.estimatedCo2SavedGrams += metric.estimatedCo2SavedGrams;
      current.estimatedRoadDistanceSavedKm += metric.estimatedRoadDistanceSavedKm;
      current.estimatedEnergyUseKwh += metric.estimatedEnergyUseKwh;
      current.averageEcoScore += ecoScore;
      current.measuredCount += metric.status === "measured" ? 1 : 0;
      current.estimatedCount += metric.status === "estimated" ? 1 : 0;
      continue;
    }

    grouped.set(monthKey, {
      monthKey,
      label: formatMonthLabel(monthKey),
      orderCount: 1,
      estimatedCo2SavedGrams: metric.estimatedCo2SavedGrams,
      estimatedRoadDistanceSavedKm: metric.estimatedRoadDistanceSavedKm,
      estimatedEnergyUseKwh: metric.estimatedEnergyUseKwh,
      averageEcoScore: ecoScore,
      measuredCount: metric.status === "measured" ? 1 : 0,
      estimatedCount: metric.status === "estimated" ? 1 : 0,
    });
  }

  return [...grouped.values()]
    .map((aggregate) => ({
      ...aggregate,
      estimatedCo2SavedGrams: Math.round(aggregate.estimatedCo2SavedGrams),
      estimatedRoadDistanceSavedKm: roundTo(aggregate.estimatedRoadDistanceSavedKm, 1),
      estimatedEnergyUseKwh: roundTo(aggregate.estimatedEnergyUseKwh, 2),
      averageEcoScore: Math.round(aggregate.averageEcoScore / aggregate.orderCount),
    }))
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey));
}

export function formatEstimatedCo2Saved(grams: number) {
  if (grams >= 1000) {
    return `${roundTo(grams / 1000, 2)} kg CO2e saved (est.)`;
  }

  return `${Math.round(grams)} g CO2e saved (est.)`;
}

export function formatRoadDistanceAvoided(kilometers: number) {
  return `${roundTo(kilometers, 1)} km road distance avoided (est.)`;
}

export function formatEcoScore(scoreOrSnapshot: number | EcoScoreSnapshot) {
  const score =
    typeof scoreOrSnapshot === "number" ? scoreOrSnapshot : scoreOrSnapshot.score;

  return `${Math.round(score)}/100 eco score`;
}

export function buildMockEcoMetric(input: EcoEstimationInput): Pick<
  EcoMetric,
  | "estimatedCo2SavedGrams"
  | "estimatedRoadDistanceSavedKm"
  | "estimatedEnergyUseKwh"
  | "methodologyNote"
> {
  const estimatedRoadDistanceSavedKm = estimateRoadDistanceAvoided(input.roadDistanceKm);
  const estimatedEnergyUseKwh = roundTo(input.droneEnergyUseKwh, 2);

  return {
    estimatedCo2SavedGrams: estimateCo2Saved({
      roadDistanceKm: estimatedRoadDistanceSavedKm,
      droneEnergyUseKwh: estimatedEnergyUseKwh,
      roadEmissionFactorGramsPerKm: input.roadEmissionFactorGramsPerKm,
      electricEmissionFactorGramsPerKwh: input.electricEmissionFactorGramsPerKwh,
    }),
    estimatedRoadDistanceSavedKm,
    estimatedEnergyUseKwh,
    methodologyNote:
      "Estimated against a conservative urban road courier baseline and should be treated as directional reporting, not as a verified emissions claim.",
  };
}
