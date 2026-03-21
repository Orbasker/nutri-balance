export type ConfidenceLabel = "high" | "good" | "moderate" | "low";

export interface NutrientSummary {
  name: string;
  displayName: string;
  valuePer100g: number;
  unit: string;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
}

export interface FoodVariantSummary {
  id: string;
  preparationMethod: string;
  isDefault: boolean;
  topNutrient: NutrientSummary | null;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  category: string | null;
  variants: FoodVariantSummary[];
}
