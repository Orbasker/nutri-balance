export type ConfidenceLabel = "high" | "good" | "moderate" | "low";

export type NutrientStatus = "safe" | "caution" | "exceed";

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

export interface ServingMeasure {
  id: string;
  label: string;
  gramsEquivalent: number;
}

export interface NutrientDetail {
  nutrientId: string;
  name: string;
  displayName: string;
  unit: string;
  valuePer100g: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  sourceSummary: string | null;
}

export interface FoodVariantDetail {
  id: string;
  preparationMethod: string;
  description: string | null;
  isDefault: boolean;
  servingMeasures: ServingMeasure[];
  nutrients: NutrientDetail[];
}

export interface FoodDetail {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  variants: FoodVariantDetail[];
}

export interface NutrientImpact {
  nutrientId: string;
  displayName: string;
  unit: string;
  consumedToday: number;
  addedAmount: number;
  newTotal: number;
  dailyLimit: number | null;
  mode: "strict" | "stability" | null;
  rangeMin: number | null;
  rangeMax: number | null;
  status: NutrientStatus;
}

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

export interface LogEntry {
  id: string;
  foodVariantId: string;
  foodName: string;
  preparationMethod: string;
  quantity: number;
  servingLabel: string | null;
  mealLabel: string | null;
  loggedAt: string;
  nutrientSnapshot: Record<string, number>;
}

export interface DailyNutrientTotal {
  nutrientId: string;
  displayName: string;
  unit: string;
  total: number;
  dailyLimit: number | null;
  mode: "strict" | "stability" | null;
  status: NutrientStatus;
}

export interface LogEntryNutrientInfo {
  nutrientId: string;
  displayName: string;
  unit: string;
}
