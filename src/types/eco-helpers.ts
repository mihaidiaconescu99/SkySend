import type { EcoMetric } from "@/types/entities";

export type EcoScoreBand = "low" | "moderate" | "strong" | "excellent";

export type EcoScoreSnapshot = {
  score: number;
  band: EcoScoreBand;
  label: string;
};

export type MonthlyEcoAggregate = {
  monthKey: string;
  label: string;
  orderCount: number;
  estimatedCo2SavedGrams: number;
  estimatedRoadDistanceSavedKm: number;
  estimatedEnergyUseKwh: number;
  averageEcoScore: number;
  measuredCount: number;
  estimatedCount: number;
};

export type EcoEstimationInput = {
  roadDistanceKm: number;
  droneEnergyUseKwh: number;
  roadEmissionFactorGramsPerKm?: number;
  electricEmissionFactorGramsPerKwh?: number;
};

export type EcoMetricLike = Pick<
  EcoMetric,
  | "status"
  | "estimatedCo2SavedGrams"
  | "estimatedRoadDistanceSavedKm"
  | "estimatedEnergyUseKwh"
  | "createdAt"
>;
