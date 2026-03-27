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
  isAiGenerated?: boolean;
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

// Admin types

export interface AdminFoodListItem {
  id: string;
  name: string;
  category: string | null;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFoodDetail {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  variants: AdminFoodVariant[];
}

export interface AdminFoodVariant {
  id: string;
  preparationMethod: string;
  description: string | null;
  isDefault: boolean;
  nutrients: AdminNutrientValue[];
}

export interface AdminNutrientValue {
  resolvedId: string;
  nutrientId: string;
  nutrientName: string;
  nutrientDisplayName: string;
  nutrientUnit: string;
  valuePer100g: number;
  confidenceScore: number;
}

export interface PendingObservation {
  id: string;
  foodVariantId: string;
  foodName: string;
  preparationMethod: string;
  nutrientName: string;
  nutrientDisplayName: string;
  value: number;
  unit: string;
  derivationType: string;
  confidenceScore: number;
  reviewStatus: string;
  evidenceItems: EvidenceItem[];
}

export interface AiObservationItem extends PendingObservation {
  sourceName: string | null;
  sourceType: string | null;
  importedAt: string | null;
}

export interface AiObservationStatusCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
  needsRevision: number;
}

export interface EvidenceItem {
  id: string;
  snippet: string | null;
  pageRef: string | null;
  rowLocator: string | null;
  url: string | null;
}

export interface NutrientOption {
  id: string;
  name: string;
  displayName: string;
  unit: string;
}

// Food Feedback types

export interface FoodFeedbackItem {
  id: string;
  foodId: string;
  nutrientId: string | null;
  foodVariantId: string | null;
  userId: string;
  type: "flag" | "correction";
  message: string;
  suggestedValue: number | null;
  suggestedUnit: string | null;
  sourceUrl: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reviewedAt: string | null;
  // Joined fields
  nutrientDisplayName?: string;
  nutrientUnit?: string;
}

// Admin Food Review types

export interface FoodReviewItem {
  id: string;
  name: string;
  category: string | null;
  createdAt: string;
  createdBy: string | null;
  variantCount: number;
  pendingObservationCount: number;
  avgConfidence: number;
  feedbackCount: number;
  variants: FoodReviewVariant[];
}

export interface FoodReviewVariant {
  id: string;
  preparationMethod: string;
  nutrients: FoodReviewNutrient[];
}

export interface FoodReviewNutrient {
  nutrientDisplayName: string;
  value: number;
  unit: string;
  confidenceScore: number;
  reviewStatus: string;
}

// Search filters & pagination

export interface SearchFilters {
  category?: string;
  confidenceLevel?: ConfidenceLabel;
  aiGeneratedOnly?: boolean;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedSearchResult {
  results: FoodSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  searchType: "food" | "nutrient";
  nutrientName?: string;
  nutrientId?: string;
  availableCategories: string[];
}
