"use server";

import type {
  FoodSearchResult,
  NutrientOption,
  PaginatedSearchResult,
  PaginationParams,
  SearchFilters,
} from "@/types";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { aiResearchFood } from "@/lib/ai/food-search-agent";
import { aiSearchByNutrient } from "@/lib/ai/nutrient-search-agent";
import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { foodAliases, foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { searchInputSchema } from "@/lib/validators";

import { type SearchRow, mapSearchRows } from "./search-utils";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Check if query matches a nutrient name/display_name.
 * Returns the nutrient if found, null otherwise.
 */
async function findMatchingNutrient(query: string) {
  const term = query.trim().toLowerCase();
  const allNutrients = await db.select().from(nutrients);
  return (
    allNutrients.find(
      (n) =>
        n.name.toLowerCase() === term ||
        n.displayName.toLowerCase() === term ||
        n.displayName.toLowerCase().replace(/\s+/g, "") === term.replace(/\s+/g, "") ||
        n.name.toLowerCase().replace(/_/g, " ") === term,
    ) ?? null
  );
}

/** Confidence score ranges by label */
const confidenceRanges: Record<string, { min: number; max: number }> = {
  high: { min: 90, max: 100 },
  good: { min: 80, max: 89 },
  moderate: { min: 60, max: 79 },
  low: { min: 0, max: 59 },
};

/**
 * Build WHERE conditions for filters applied to food-level queries.
 */
function buildFilterConditions(filters: SearchFilters) {
  const conditions = [];
  if (filters.category) {
    conditions.push(eq(foods.category, filters.category));
  }
  if (filters.aiGeneratedOnly) {
    conditions.push(sql`${resolvedNutrientValues.sourceSummary} LIKE 'AI-generated%'`);
  }
  if (filters.confidenceLevel) {
    const range = confidenceRanges[filters.confidenceLevel];
    if (range) {
      conditions.push(gte(resolvedNutrientValues.confidenceScore, range.min));
      conditions.push(lte(resolvedNutrientValues.confidenceScore, range.max));
    }
  }
  return conditions;
}

/**
 * Get distinct categories from foods that match a set of food IDs.
 */
async function getCategoriesForIds(foodIds: string[]): Promise<string[]> {
  if (foodIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ category: foods.category })
    .from(foods)
    .where(and(sql`${foods.category} IS NOT NULL`, inArray(foods.id, foodIds)));
  return rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null)
    .sort();
}

/**
 * Get distinct categories for foods that have data for a specific nutrient.
 */
async function getCategoriesForNutrient(nutrientId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: foods.category })
    .from(resolvedNutrientValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedNutrientValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .where(
      and(sql`${foods.category} IS NOT NULL`, eq(resolvedNutrientValues.nutrientId, nutrientId)),
    );
  return rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null)
    .sort();
}

/**
 * Search foods by nutrient — paginated, with filters.
 */
async function searchByNutrient(
  nutrientId: string,
  filters: SearchFilters,
  pagination: PaginationParams,
): Promise<{ results: FoodSearchResult[]; totalCount: number; categories: string[] }> {
  const filterConditions = buildFilterConditions(filters);
  const baseWhere = and(eq(resolvedNutrientValues.nutrientId, nutrientId), ...filterConditions);

  // Count distinct foods matching the nutrient + filters
  const [countResult] = await db
    .select({ total: countDistinct(foods.id) })
    .from(resolvedNutrientValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedNutrientValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(baseWhere);

  const totalCount = Number(countResult?.total ?? 0);

  // Get the paginated set of food IDs (ordered by highest nutrient value)
  const paginatedFoodIdRows = await db
    .select({ id: foods.id })
    .from(resolvedNutrientValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedNutrientValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(baseWhere)
    .groupBy(foods.id)
    .orderBy(desc(sql`MAX(${resolvedNutrientValues.valuePer100g})`))
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);

  const foodIds = paginatedFoodIdRows.map((r) => r.id);
  if (foodIds.length === 0) {
    const categories = await getCategoriesForNutrient(nutrientId);
    return { results: [], totalCount, categories };
  }

  // Fetch full rows for paginated food IDs
  const rows = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      isDefault: foodVariants.isDefault,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      nutrientUnit: nutrients.unit,
      valuePer100g: resolvedNutrientValues.valuePer100g,
      confidenceScore: resolvedNutrientValues.confidenceScore,
      sourceSummary: resolvedNutrientValues.sourceSummary,
    })
    .from(resolvedNutrientValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedNutrientValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(inArray(foods.id, foodIds))
    .orderBy(desc(resolvedNutrientValues.valuePer100g));

  // Get available categories for filters (unfiltered by category to show all options)
  const categories = await getCategoriesForNutrient(nutrientId);

  return {
    results: mapSearchRows(rows as SearchRow[]),
    totalCount,
    categories,
  };
}

/**
 * Standard food name/alias search — paginated, with filters.
 */
async function searchByName(
  query: string,
  filters: SearchFilters,
  pagination: PaginationParams,
): Promise<{ results: FoodSearchResult[]; totalCount: number; categories: string[] }> {
  const searchTerm = `%${query}%`;

  // Get all matching food IDs by name/alias
  const matchingRows = await db
    .select({ id: foods.id })
    .from(foods)
    .leftJoin(foodAliases, eq(foodAliases.foodId, foods.id))
    .where(or(ilike(foods.name, searchTerm), ilike(foodAliases.alias, searchTerm)))
    .groupBy(foods.id);

  const allMatchingIds = matchingRows.map((r) => r.id);
  if (allMatchingIds.length === 0) {
    return { results: [], totalCount: 0, categories: [] };
  }

  // Get available categories (from name-matched foods, unfiltered)
  const categories = await getCategoriesForIds(allMatchingIds);

  // Build filter conditions
  const filterConditions = buildFilterConditions(filters);
  const baseConditions = [inArray(foods.id, allMatchingIds), ...filterConditions];

  // For filters that need joins (confidence, AI), we need the full join
  const needsNutrientJoin = filters.confidenceLevel || filters.aiGeneratedOnly;

  let totalCount: number;
  if (needsNutrientJoin) {
    const [countResult] = await db
      .select({ total: countDistinct(foods.id) })
      .from(foods)
      .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
      .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
      .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
      .where(and(...baseConditions));
    totalCount = Number(countResult?.total ?? 0);
  } else {
    const countConditions = [inArray(foods.id, allMatchingIds)];
    if (filters.category) {
      countConditions.push(eq(foods.category, filters.category));
    }
    const [countResult] = await db
      .select({ total: count() })
      .from(foods)
      .where(and(...countConditions));
    totalCount = Number(countResult?.total ?? 0);
  }

  // Get paginated food IDs
  let paginatedIdRows;
  if (needsNutrientJoin) {
    paginatedIdRows = await db
      .select({ id: foods.id })
      .from(foods)
      .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
      .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
      .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
      .where(and(...baseConditions))
      .groupBy(foods.id)
      .orderBy(foods.name)
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);
  } else {
    const paginateConditions = [inArray(foods.id, allMatchingIds)];
    if (filters.category) {
      paginateConditions.push(eq(foods.category, filters.category));
    }
    paginatedIdRows = await db
      .select({ id: foods.id })
      .from(foods)
      .where(and(...paginateConditions))
      .orderBy(foods.name)
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);
  }

  const foodIds = paginatedIdRows.map((r) => r.id);
  if (foodIds.length === 0) {
    return { results: [], totalCount, categories };
  }

  // Fetch full rows for paginated food IDs
  const rows = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      isDefault: foodVariants.isDefault,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      nutrientUnit: nutrients.unit,
      valuePer100g: resolvedNutrientValues.valuePer100g,
      confidenceScore: resolvedNutrientValues.confidenceScore,
      sourceSummary: resolvedNutrientValues.sourceSummary,
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
    .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(inArray(foods.id, foodIds))
    .orderBy(foods.name);

  return {
    results: mapSearchRows(rows as SearchRow[]),
    totalCount,
    categories,
  };
}

/**
 * List all nutrients sorted by sortOrder.
 * Used by the nutrient search mode to populate the autocomplete picker.
 */
export async function listNutrients(): Promise<NutrientOption[]> {
  const rows = await db
    .select({
      id: nutrients.id,
      name: nutrients.name,
      displayName: nutrients.displayName,
      unit: nutrients.unit,
    })
    .from(nutrients)
    .orderBy(asc(nutrients.sortOrder));

  return rows;
}

/**
 * Search foods by nutrient ID — public server action wrapping the internal searchByNutrient.
 * Accepts a nutrientId directly (no query matching needed).
 */
export async function searchByNutrientId(
  nutrientId: string,
  filters: SearchFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
): Promise<PaginatedSearchResult> {
  if (!nutrientId?.trim()) {
    return {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: pagination.pageSize,
      totalPages: 0,
      searchType: "nutrient",
      availableCategories: [],
    };
  }

  // Look up the nutrient to get its display name
  const [nutrient] = await db
    .select({ id: nutrients.id, displayName: nutrients.displayName })
    .from(nutrients)
    .where(eq(nutrients.id, nutrientId));

  if (!nutrient) {
    return {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: pagination.pageSize,
      totalPages: 0,
      searchType: "nutrient",
      availableCategories: [],
    };
  }

  const { results, totalCount, categories } = await searchByNutrient(
    nutrientId,
    filters,
    pagination,
  );

  return {
    results,
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(totalCount / pagination.pageSize),
    searchType: "nutrient",
    nutrientName: nutrient.displayName,
    nutrientId,
    availableCategories: categories,
  };
}

export type SearchResult = PaginatedSearchResult;

export async function searchFoods(
  query: string,
  filters: SearchFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
): Promise<SearchResult> {
  const parsed = searchInputSchema.safeParse({ query });
  if (!parsed.success) {
    return {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: pagination.pageSize,
      totalPages: 0,
      searchType: "food",
      availableCategories: [],
    };
  }

  // Check if the query matches a nutrient name
  const matchedNutrient = await findMatchingNutrient(parsed.data.query);
  if (matchedNutrient) {
    const { results, totalCount, categories } = await searchByNutrient(
      matchedNutrient.id,
      filters,
      pagination,
    );
    return {
      results,
      totalCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      searchType: "nutrient",
      nutrientName: matchedNutrient.displayName,
      nutrientId: matchedNutrient.id,
      availableCategories: categories,
    };
  }

  // Standard food name/alias search
  const { results, totalCount, categories } = await searchByName(
    parsed.data.query,
    filters,
    pagination,
  );
  return {
    results,
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(totalCount / pagination.pageSize),
    searchType: "food",
    availableCategories: categories,
  };
}

export type AiSearchResult =
  | { status: "found"; foodId: string }
  | { status: "error"; message: string };

/**
 * AI-powered food search: researches a food not in the database,
 * persists it with AI-generated nutrient data, and returns its ID.
 */
export async function aiSearchFood(query: string): Promise<AiSearchResult> {
  const parsed = searchInputSchema.safeParse({ query });
  if (!parsed.success) {
    return { status: "error", message: "Search query too short." };
  }

  const session = await getSession();

  if (!session) {
    return { status: "error", message: "You must be signed in." };
  }

  const result = await aiResearchFood(parsed.data.query, session.user.id);

  if ("error" in result) {
    return { status: "error", message: result.error };
  }

  return { status: "found", foodId: result.foodId };
}

export type AiNutrientSearchResult =
  | { status: "found"; count: number; summary: string }
  | { status: "error"; message: string };

/**
 * AI-powered nutrient search: Explorer agent finds data sources (USDA API, web),
 * Parser agent extracts food entries into the DB.
 */
export async function aiDiscoverFoodsByNutrient(
  nutrientId: string,
): Promise<AiNutrientSearchResult> {
  const session = await getSession();

  if (!session) {
    return { status: "error", message: "You must be signed in." };
  }

  const result = await aiSearchByNutrient(nutrientId, session.user.id);

  if ("error" in result) {
    return { status: "error", message: result.error };
  }

  return {
    status: "found",
    count: result.foodIds.length,
    summary: result.summary,
  };
}

export type PdfUploadResult =
  | { status: "success"; count: number; skipped: number }
  | { status: "error"; message: string };

/**
 * Upload and parse a PDF containing nutrient data (e.g., USDA reports).
 * Extracts all food entries and adds them to the database.
 */
export async function uploadNutrientPdf(formData: FormData): Promise<PdfUploadResult> {
  const session = await getSession();

  if (!session) {
    return { status: "error", message: "You must be signed in." };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { status: "error", message: "No file provided." };
  }

  if (!file.name.endsWith(".pdf")) {
    return { status: "error", message: "Only PDF files are supported." };
  }

  if (file.size > 20 * 1024 * 1024) {
    return { status: "error", message: "File too large. Maximum 20MB." };
  }

  const sourceUrl = (formData.get("sourceUrl") as string) ?? undefined;

  const { parsePdfToFoods } = await import("@/lib/ai/pdf-food-parser");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await parsePdfToFoods(buffer, file.name, session.user.id, sourceUrl);

  if ("error" in result) {
    return { status: "error", message: result.error };
  }

  return { status: "success", count: result.count, skipped: result.skipped };
}
