import type { FoodSearchResult, FoodVariantSummary, NutrientSummary } from "@/types";

import { getConfidenceLabel } from "@/lib/calculations";

export interface SearchRow {
  foodId: string;
  foodName: string;
  category: string | null;
  variantId: string | null;
  preparationMethod: string | null;
  isDefault: boolean | null;
  nutrientName: string | null;
  nutrientDisplayName: string | null;
  nutrientUnit: string | null;
  valuePer100g: string | null;
  confidenceScore: number | null;
  sourceSummary: string | null;
}

/**
 * Transform flat DB rows (food x variant x nutrient join) into grouped FoodSearchResult[].
 * Picks the highest-value nutrient per variant as the topNutrient.
 */
export function mapSearchRows(rows: SearchRow[]): FoodSearchResult[] {
  if (rows.length === 0) return [];

  // Group by food, then by variant, collecting nutrients per variant
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
          nutrients: NutrientSummary[];
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
          nutrients: [],
        };
        food.variants.set(row.variantId, variant);
      }

      if (row.sourceSummary?.startsWith("AI-generated")) {
        food.isAiGenerated = true;
      }

      if (row.nutrientName && row.valuePer100g !== null) {
        variant.nutrients.push({
          name: row.nutrientName,
          displayName: row.nutrientDisplayName ?? row.nutrientName,
          valuePer100g: parseFloat(row.valuePer100g),
          unit: row.nutrientUnit ?? "",
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
      // Pick the nutrient with the highest value as the "top nutrient"
      const topNutrient =
        variant.nutrients.length > 0
          ? variant.nutrients.reduce((best, n) => (n.valuePer100g > best.valuePer100g ? n : best))
          : null;

      variants.push({
        id: variant.id,
        preparationMethod: variant.preparationMethod,
        isDefault: variant.isDefault,
        topNutrient,
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
