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

export type NutrientStatus = "safe" | "caution" | "exceed";

export interface NutrientProgress {
  nutrientId: string;
  name: string;
  displayName: string;
  unit: string;
  dailyLimit: number;
  consumed: number;
  remaining: number;
  percentage: number;
  status: NutrientStatus;
}

export interface RecentLogEntry {
  id: string;
  foodName: string;
  preparationMethod: string;
  quantity: string;
  servingLabel: string | null;
  mealLabel: string | null;
  loggedAt: string;
}
