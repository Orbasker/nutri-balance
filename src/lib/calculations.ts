import type { ConfidenceLabel, NutrientStatus } from "@/types";

/**
 * Map a numeric confidence score (0-100) to a human-readable label.
 *
 * High: 90-100, Good: 80-89, Moderate: 60-79, Low: <60
 */
export function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 90) return "high";
  if (score >= 80) return "good";
  if (score >= 60) return "moderate";
  return "low";
}

/**
 * Determine nutrient status from consumed percentage of daily limit.
 *
 * safe: <80%, caution: 80-100%, exceed: >100%
 */
export function getNutrientStatus(percentage: number): NutrientStatus {
  if (percentage > 100) return "exceed";
  if (percentage >= 80) return "caution";
  return "safe";
}
