import type { ConfidenceLabel, SubstanceStatus } from "@/types";

import type { SubstanceReferenceValues } from "@/lib/substance-reference-values";
import {
  DEFAULT_SUBSTANCE_REFERENCE_VALUES,
  normalizeSubstanceReferenceKey,
} from "@/lib/substance-reference-values";

type ProminenceBasis = "reference" | "mass" | "raw";

const MASS_UNIT_FACTORS: Record<string, number> = {
  g: 1_000_000,
  mg: 1_000,
  mcg: 1,
  ug: 1,
  µg: 1,
};

function getProminenceBasisRank(basis: ProminenceBasis): number {
  if (basis === "reference") return 3;
  if (basis === "mass") return 2;
  return 1;
}

export function getReferenceDailyValue(
  name: string,
  displayName?: string,
  referenceValues: SubstanceReferenceValues = DEFAULT_SUBSTANCE_REFERENCE_VALUES,
): number | null {
  const keys = [name, displayName]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSubstanceReferenceKey);

  for (const key of keys) {
    const value = referenceValues[key];
    if (value != null) return value;
  }

  return null;
}

export function getSubstanceProminence(
  input: {
    name: string;
    displayName?: string;
    amount: number;
    unit: string;
  },
  referenceValues: SubstanceReferenceValues = DEFAULT_SUBSTANCE_REFERENCE_VALUES,
): {
  basis: ProminenceBasis;
  score: number;
} {
  const referenceDailyValue = getReferenceDailyValue(
    input.name,
    input.displayName,
    referenceValues,
  );
  if (referenceDailyValue && referenceDailyValue > 0) {
    return {
      basis: "reference",
      score: input.amount / referenceDailyValue,
    };
  }

  const massFactor = MASS_UNIT_FACTORS[input.unit.trim().toLowerCase()];
  if (massFactor) {
    return {
      basis: "mass",
      score: input.amount * massFactor,
    };
  }

  return {
    basis: "raw",
    score: input.amount,
  };
}

export function compareSubstanceProminence(
  a: { name: string; displayName?: string; amount: number; unit: string },
  b: { name: string; displayName?: string; amount: number; unit: string },
  referenceValues: SubstanceReferenceValues = DEFAULT_SUBSTANCE_REFERENCE_VALUES,
): number {
  const left = getSubstanceProminence(a, referenceValues);
  const right = getSubstanceProminence(b, referenceValues);
  const rankDelta = getProminenceBasisRank(left.basis) - getProminenceBasisRank(right.basis);

  if (rankDelta !== 0) return rankDelta;
  return left.score - right.score;
}

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
 * Calculate the substance amount for a given serving.
 * Formula: (value_per_100g) × (portion_g / 100)
 */
export function calculateSubstanceAmount(valuePer100g: number, portionGrams: number): number {
  return (valuePer100g * portionGrams) / 100;
}

/**
 * Determine the status of a substance relative to its daily limit.
 * safe: <80%, caution: 80-100%, exceed: >100%
 */
export function getSubstanceStatus(total: number, dailyLimit: number | null): SubstanceStatus {
  if (dailyLimit === null || dailyLimit <= 0) return "safe";
  const pct = (total / dailyLimit) * 100;
  if (pct > 100) return "exceed";
  if (pct >= 80) return "caution";
  return "safe";
}
