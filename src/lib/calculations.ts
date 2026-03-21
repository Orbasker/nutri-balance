import type { ConfidenceLabel } from "@/types";

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
