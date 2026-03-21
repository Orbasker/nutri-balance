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
 * Calculate the nutrient amount for a given serving.
 * Formula: (value_per_100g) × (portion_g / 100)
 */
export function calculateNutrientAmount(valuePer100g: number, portionGrams: number): number {
  return (valuePer100g * portionGrams) / 100;
}

/**
 * Determine the status of a nutrient relative to its daily limit.
 * safe: <80%, caution: 80-100%, exceed: >100%
 */
export function getNutrientStatus(total: number, dailyLimit: number | null): NutrientStatus {
  if (dailyLimit === null || dailyLimit <= 0) return "safe";
  const pct = (total / dailyLimit) * 100;
  if (pct > 100) return "exceed";
  if (pct >= 80) return "caution";
  return "safe";
}
