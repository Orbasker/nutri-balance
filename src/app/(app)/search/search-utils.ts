import type { FoodSearchResult, FoodVariantSummary, SubstanceSummary } from "@/types";

import { getConfidenceLabel } from "@/lib/calculations";

export interface SearchRow {
  foodId: string;
  foodName: string;
  category: string | null;
  variantId: string | null;
  preparationMethod: string | null;
  isDefault: boolean | null;
  substanceName: string | null;
  substanceDisplayName: string | null;
  substanceUnit: string | null;
  valuePer100g: string | null;
  confidenceScore: number | null;
  sourceSummary: string | null;
}

/**
 * Transform flat DB rows (food x variant x substance join) into grouped FoodSearchResult[].
 * Picks the highest-value substance per variant as the topSubstance.
 */
export function mapSearchRows(rows: SearchRow[]): FoodSearchResult[] {
  if (rows.length === 0) return [];

  // Group by food, then by variant, collecting substances per variant
  const foodMap = new Map<
    string,
    {
      id: string;
      name: string;
      category: string | null;
      isAiGenerated: boolean;
      variants: Map<
        string,
        {
          id: string;
          preparationMethod: string;
          isDefault: boolean;
          substances: SubstanceSummary[];
        }
      >;
    }
  >();

  for (const row of rows) {
    let food = foodMap.get(row.foodId);
    if (!food) {
      food = {
        id: row.foodId,
        name: row.foodName,
        category: row.category,
        isAiGenerated: false,
        variants: new Map(),
      };
      foodMap.set(row.foodId, food);
    }

    if (row.variantId) {
      let variant = food.variants.get(row.variantId);
      if (!variant) {
        variant = {
          id: row.variantId,
          preparationMethod: row.preparationMethod ?? "raw",
          isDefault: row.isDefault ?? false,
          substances: [],
        };
        food.variants.set(row.variantId, variant);
      }

      if (row.sourceSummary?.startsWith("AI-generated")) {
        food.isAiGenerated = true;
      }

      if (row.substanceName && row.valuePer100g !== null) {
        variant.substances.push({
          name: row.substanceName,
          displayName: row.substanceDisplayName ?? row.substanceName,
          valuePer100g: parseFloat(row.valuePer100g),
          unit: row.substanceUnit ?? "",
          confidenceScore: row.confidenceScore ?? 0,
          confidenceLabel: getConfidenceLabel(row.confidenceScore ?? 0),
        });
      }
    }
  }

  const results: FoodSearchResult[] = [];

  for (const food of foodMap.values()) {
    const variants: FoodVariantSummary[] = [];

    for (const variant of food.variants.values()) {
      // Pick the substance with the highest value as the "top substance"
      const topSubstance =
        variant.substances.length > 0
          ? variant.substances.reduce((best, n) => (n.valuePer100g > best.valuePer100g ? n : best))
          : null;

      variants.push({
        id: variant.id,
        preparationMethod: variant.preparationMethod,
        isDefault: variant.isDefault,
        topSubstance,
      });
    }

    results.push({
      id: food.id,
      name: food.name,
      category: food.category,
      variants,
      isAiGenerated: food.isAiGenerated,
    });
  }

  return results;
}
