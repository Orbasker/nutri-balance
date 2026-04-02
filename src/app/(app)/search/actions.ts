"use server";

import type {
  FoodSearchResult,
  PaginatedSearchResult,
  PaginationParams,
  SearchFilters,
  SubstanceOption,
} from "@/types";
import { and, asc, countDistinct, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

import { aiResearchFood } from "@/lib/ai/food-search-agent";
import { aiSearchBySubstance } from "@/lib/ai/substance-search-agent";
import { getSubstanceReferenceValues } from "@/lib/app-config";
import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { foodAliases, foodVariants, foods } from "@/lib/db/schema/foods";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { searchInputSchema } from "@/lib/validators";

import {
  dedupeSearchTerms,
  escapeLikePattern,
  generateAiSearchAssist,
  getSimilarityThreshold,
  normalizeSearchTerm,
} from "./search-assist";
import { type SearchRow, mapSearchRows } from "./search-utils";

const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_MATCHES = 120;

function createSubstanceSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function inferUnitForCustomSubstance(name: string) {
  const normalized = name.trim().toLowerCase();

  const explicitUnits: Record<string, string> = {
    caffeine: "mg",
    calcium: "mg",
    carbohydrate: "g",
    carbohydrates: "g",
    cholesterol: "mg",
    copper: "mg",
    fat: "g",
    fiber: "g",
    folate: "mcg",
    gluten: "g",
    iodine: "mcg",
    iron: "mg",
    magnesium: "mg",
    manganese: "mg",
    niacin: "mg",
    phosphorus: "mg",
    potassium: "mg",
    protein: "g",
    riboflavin: "mg",
    selenium: "mcg",
    sodium: "mg",
    sugar: "g",
    sugars: "g",
    thiamin: "mg",
    zinc: "mg",
  };

  if (explicitUnits[normalized]) {
    return explicitUnits[normalized];
  }

  if (normalized.startsWith("vitamin ")) {
    if (
      normalized === "vitamin a" ||
      normalized === "vitamin b12" ||
      normalized === "vitamin d" ||
      normalized === "vitamin k"
    ) {
      return "mcg";
    }

    return "mg";
  }

  if (
    normalized.includes("protein") ||
    normalized.includes("fiber") ||
    normalized.includes("gluten")
  ) {
    return "g";
  }

  return "mg";
}

/**
 * Check if query matches a substance name/display_name.
 * Returns the substance if found, null otherwise.
 */
async function findMatchingSubstance(query: string) {
  const term = query.trim().toLowerCase();
  const allSubstances = await db.select().from(substances);
  return (
    allSubstances.find(
      (n) =>
        n.name.toLowerCase() === term ||
        n.displayName.toLowerCase() === term ||
        n.displayName.toLowerCase().replace(/\s+/g, "") === term.replace(/\s+/g, "") ||
        n.name.toLowerCase().replace(/_/g, " ") === term,
    ) ?? null
  );
}

type RankedFoodMatch = {
  id: string;
  relevance: number;
};

function orderFoodsByRelevance(
  matches: RankedFoodMatch[],
  candidateIds?: Iterable<string>,
): string[] {
  const relevanceById = new Map<string, number>();

  for (const match of matches) {
    const current = relevanceById.get(match.id) ?? Number.NEGATIVE_INFINITY;
    if (match.relevance > current) {
      relevanceById.set(match.id, match.relevance);
    }
  }

  const rankedIds = [...relevanceById.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id);

  if (!candidateIds) {
    return rankedIds;
  }

  const candidateSet = new Set(candidateIds);
  return rankedIds.filter((id) => candidateSet.has(id));
}

async function searchFoodsForTerm(term: string): Promise<RankedFoodMatch[]> {
  const normalizedTerm = normalizeSearchTerm(term);

  if (normalizedTerm.length < 2) {
    return [];
  }

  const likePattern = `%${escapeLikePattern(normalizedTerm.toLowerCase())}%`;
  const similarityThreshold = getSimilarityThreshold(normalizedTerm);
  const nameSimilarity = sql<number>`extensions.similarity(lower(${foods.name}), lower(${normalizedTerm}))`;
  const aliasSimilarity = sql<number>`extensions.similarity(lower(${foodAliases.alias}), lower(${normalizedTerm}))`;
  const relevance = sql<number>`GREATEST(
    CASE WHEN lower(${foods.name}) = lower(${normalizedTerm}) THEN 1000 ELSE 0 END,
    COALESCE(MAX(CASE WHEN lower(${foodAliases.alias}) = lower(${normalizedTerm}) THEN 980 ELSE 0 END), 0),
    CASE WHEN lower(${foods.name}) LIKE ${likePattern} ESCAPE '\\' THEN 720 ELSE 0 END,
    COALESCE(MAX(CASE WHEN lower(${foodAliases.alias}) LIKE ${likePattern} ESCAPE '\\' THEN 680 ELSE 0 END), 0),
    ${nameSimilarity} * 100,
    COALESCE(MAX(${aliasSimilarity} * 95), 0)
  )`;

  const rows = await db
    .select({
      id: foods.id,
      relevance,
    })
    .from(foods)
    .leftJoin(foodAliases, eq(foodAliases.foodId, foods.id))
    .where(
      or(
        sql`lower(${foods.name}) LIKE ${likePattern} ESCAPE '\\'`,
        sql`lower(${foodAliases.alias}) LIKE ${likePattern} ESCAPE '\\'`,
        sql`${nameSimilarity} >= ${similarityThreshold}`,
        sql`${aliasSimilarity} >= ${similarityThreshold}`,
      ),
    )
    .groupBy(foods.id, foods.name)
    .orderBy(desc(relevance), asc(foods.name))
    .limit(MAX_SEARCH_MATCHES);

  return rows.map((row) => ({
    id: row.id,
    relevance: Number(row.relevance),
  }));
}

async function findMatchingFoodIds(query: string, extraTerms: string[] = []) {
  const searchTerms = dedupeSearchTerms([query, ...extraTerms]);
  const matchSets = await Promise.all(searchTerms.map((term) => searchFoodsForTerm(term)));

  return orderFoodsByRelevance(matchSets.flat()).slice(0, MAX_SEARCH_MATCHES);
}

async function findSearchSubstance(query: string) {
  const exactMatch = await findMatchingSubstance(query);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedTerm = normalizeSearchTerm(query);
  const likePattern = `%${escapeLikePattern(normalizedTerm.toLowerCase())}%`;
  const similarityThreshold = getSimilarityThreshold(normalizedTerm);
  const displayNameSimilarity = sql<number>`extensions.similarity(lower(${substances.displayName}), lower(${normalizedTerm}))`;
  const internalNameSimilarity = sql<number>`extensions.similarity(replace(lower(${substances.name}), '_', ' '), lower(${normalizedTerm}))`;
  const relevance = sql<number>`GREATEST(
    CASE WHEN lower(${substances.displayName}) = lower(${normalizedTerm}) THEN 1000 ELSE 0 END,
    CASE WHEN replace(lower(${substances.name}), '_', ' ') = lower(${normalizedTerm}) THEN 980 ELSE 0 END,
    CASE WHEN lower(${substances.displayName}) LIKE ${likePattern} ESCAPE '\\' THEN 720 ELSE 0 END,
    CASE WHEN replace(lower(${substances.name}), '_', ' ') LIKE ${likePattern} ESCAPE '\\' THEN 680 ELSE 0 END,
    ${displayNameSimilarity} * 100,
    ${internalNameSimilarity} * 95
  )`;

  const [match] = await db
    .select({
      id: substances.id,
      name: substances.name,
      displayName: substances.displayName,
      unit: substances.unit,
      relevance,
    })
    .from(substances)
    .where(
      or(
        sql`lower(${substances.displayName}) LIKE ${likePattern} ESCAPE '\\'`,
        sql`replace(lower(${substances.name}), '_', ' ') LIKE ${likePattern} ESCAPE '\\'`,
        sql`${displayNameSimilarity} >= ${similarityThreshold}`,
        sql`${internalNameSimilarity} >= ${similarityThreshold}`,
      ),
    )
    .orderBy(desc(relevance), asc(substances.sortOrder))
    .limit(1);

  return match ?? null;
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
    conditions.push(sql`${resolvedSubstanceValues.sourceSummary} LIKE 'AI-generated%'`);
  }
  if (filters.confidenceLevel) {
    const range = confidenceRanges[filters.confidenceLevel];
    if (range) {
      conditions.push(gte(resolvedSubstanceValues.confidenceScore, range.min));
      conditions.push(lte(resolvedSubstanceValues.confidenceScore, range.max));
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
 * Get distinct categories for foods that have data for a specific substance.
 */
async function getCategoriesForSubstance(substanceId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: foods.category })
    .from(resolvedSubstanceValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedSubstanceValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .where(
      and(sql`${foods.category} IS NOT NULL`, eq(resolvedSubstanceValues.substanceId, substanceId)),
    );
  return rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null)
    .sort();
}

/**
 * Search foods by substance - paginated, with filters.
 */
async function searchBySubstance(
  substanceId: string,
  filters: SearchFilters,
  pagination: PaginationParams,
): Promise<{ results: FoodSearchResult[]; totalCount: number; categories: string[] }> {
  const substanceReferenceValues = await getSubstanceReferenceValues();
  const filterConditions = buildFilterConditions(filters);
  const baseWhere = and(eq(resolvedSubstanceValues.substanceId, substanceId), ...filterConditions);

  // Count distinct foods matching the substance + filters
  const [countResult] = await db
    .select({ total: countDistinct(foods.id) })
    .from(resolvedSubstanceValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedSubstanceValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(baseWhere);

  const totalCount = Number(countResult?.total ?? 0);

  // Get the paginated set of food IDs (ordered by highest substance value)
  const paginatedFoodIdRows = await db
    .select({ id: foods.id })
    .from(resolvedSubstanceValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedSubstanceValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(baseWhere)
    .groupBy(foods.id)
    .orderBy(desc(sql`MAX(${resolvedSubstanceValues.valuePer100g})`))
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);

  const foodIds = paginatedFoodIdRows.map((r) => r.id);
  if (foodIds.length === 0) {
    const categories = await getCategoriesForSubstance(substanceId);
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
      substanceName: substances.name,
      substanceDisplayName: substances.displayName,
      substanceUnit: substances.unit,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      confidenceScore: resolvedSubstanceValues.confidenceScore,
      sourceSummary: resolvedSubstanceValues.sourceSummary,
    })
    .from(resolvedSubstanceValues)
    .innerJoin(foodVariants, eq(foodVariants.id, resolvedSubstanceValues.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(inArray(foods.id, foodIds))
    .orderBy(desc(resolvedSubstanceValues.valuePer100g));

  // Get available categories for filters (unfiltered by category to show all options)
  const categories = await getCategoriesForSubstance(substanceId);

  return {
    results: mapSearchRows(rows as SearchRow[], substanceReferenceValues),
    totalCount,
    categories,
  };
}

/**
 * Standard food name/alias search - paginated, with filters.
 */
async function searchByName(
  query: string,
  filters: SearchFilters,
  pagination: PaginationParams,
  extraTerms: string[] = [],
): Promise<{ results: FoodSearchResult[]; totalCount: number; categories: string[] }> {
  const substanceReferenceValues = await getSubstanceReferenceValues();
  const allMatchingIds = await findMatchingFoodIds(query, extraTerms);
  if (allMatchingIds.length === 0) {
    return { results: [], totalCount: 0, categories: [] };
  }

  // Get available categories (from name-matched foods, unfiltered)
  const categories = await getCategoriesForIds(allMatchingIds);

  // Build filter conditions
  const filterConditions = buildFilterConditions(filters);
  const baseConditions = [inArray(foods.id, allMatchingIds), ...filterConditions];

  // For filters that need joins (confidence, AI), we need the full join
  const needsSubstanceJoin = filters.confidenceLevel || filters.aiGeneratedOnly;

  let filteredIds: string[];
  if (needsSubstanceJoin) {
    const rows = await db
      .select({ id: foods.id })
      .from(foods)
      .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
      .leftJoin(resolvedSubstanceValues, eq(resolvedSubstanceValues.foodVariantId, foodVariants.id))
      .leftJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
      .where(and(...baseConditions));
    const filteredIdSet = new Set(rows.map((row) => row.id));
    filteredIds = allMatchingIds.filter((id) => filteredIdSet.has(id));
  } else {
    const countConditions = [inArray(foods.id, allMatchingIds)];
    if (filters.category) {
      countConditions.push(eq(foods.category, filters.category));
    }
    const rows = await db
      .select({ id: foods.id })
      .from(foods)
      .where(and(...countConditions));
    const filteredIdSet = new Set(rows.map((row) => row.id));
    filteredIds = allMatchingIds.filter((id) => filteredIdSet.has(id));
  }

  const totalCount = filteredIds.length;
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const foodIds = filteredIds.slice(startIndex, startIndex + pagination.pageSize);
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
      substanceName: substances.name,
      substanceDisplayName: substances.displayName,
      substanceUnit: substances.unit,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      confidenceScore: resolvedSubstanceValues.confidenceScore,
      sourceSummary: resolvedSubstanceValues.sourceSummary,
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(resolvedSubstanceValues, eq(resolvedSubstanceValues.foodVariantId, foodVariants.id))
    .leftJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(inArray(foods.id, foodIds))
    .orderBy(foods.name);

  const orderIndex = new Map(foodIds.map((id, index) => [id, index]));
  const results = mapSearchRows(rows as SearchRow[], substanceReferenceValues).sort(
    (left, right) => (orderIndex.get(left.id) ?? 0) - (orderIndex.get(right.id) ?? 0),
  );

  return {
    results,
    totalCount,
    categories,
  };
}

/**
 * List all substances sorted by sortOrder.
 * Used by the substance search mode to populate the autocomplete picker.
 */
export async function listSubstances(): Promise<SubstanceOption[]> {
  const rows = await db
    .select({
      id: substances.id,
      name: substances.name,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(substances)
    .orderBy(asc(substances.sortOrder));

  return rows;
}

export async function resolveSubstanceSearchTerm(
  query: string,
): Promise<
  | { status: "matched"; substance: SubstanceOption }
  | { status: "created"; substance: SubstanceOption; message: string }
  | { status: "error"; message: string }
> {
  const parsed = searchInputSchema.safeParse({ query });
  if (!parsed.success) {
    return { status: "error", message: "Enter at least 2 characters." };
  }

  const existing = await findMatchingSubstance(parsed.data.query);
  if (existing) {
    return {
      status: "matched",
      substance: {
        id: existing.id,
        name: existing.name,
        displayName: existing.displayName,
        unit: existing.unit,
      },
    };
  }

  const session = await getSession();
  if (!session) {
    return { status: "error", message: "You must be signed in." };
  }

  const displayName = parsed.data.query;
  const slug = createSubstanceSlug(displayName);
  const unit = inferUnitForCustomSubstance(displayName);

  const [created] = await db
    .insert(substances)
    .values({
      name: `custom_${slug}_${session.user.id.slice(0, 8)}`,
      displayName,
      unit,
      sortOrder: 999,
      createdBy: session.user.id,
    })
    .returning({
      id: substances.id,
      name: substances.name,
      displayName: substances.displayName,
      unit: substances.unit,
    });

  return {
    status: "created",
    substance: created,
    message: `Added "${created.displayName}" to your substance list.`,
  };
}

/**
 * Search foods by substance ID - public server action wrapping the internal searchBySubstance.
 * Accepts a substanceId directly (no query matching needed).
 */
export async function searchBySubstanceId(
  substanceId: string,
  filters: SearchFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
): Promise<PaginatedSearchResult> {
  if (!substanceId?.trim()) {
    return {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: pagination.pageSize,
      totalPages: 0,
      searchType: "substance",
      availableCategories: [],
    };
  }

  // Look up the substance to get its display name
  const [substance] = await db
    .select({ id: substances.id, displayName: substances.displayName })
    .from(substances)
    .where(eq(substances.id, substanceId));

  if (!substance) {
    return {
      results: [],
      totalCount: 0,
      page: 1,
      pageSize: pagination.pageSize,
      totalPages: 0,
      searchType: "substance",
      availableCategories: [],
    };
  }

  const { results, totalCount, categories } = await searchBySubstance(
    substanceId,
    filters,
    pagination,
  );

  return {
    results,
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(totalCount / pagination.pageSize),
    searchType: "substance",
    substanceName: substance.displayName,
    substanceId,
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

  // Check if the query matches a substance name
  const matchedSubstance = await findMatchingSubstance(parsed.data.query);
  if (matchedSubstance) {
    const { results, totalCount, categories } = await searchBySubstance(
      matchedSubstance.id,
      filters,
      pagination,
    );
    return {
      results,
      totalCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      searchType: "substance",
      substanceName: matchedSubstance.displayName,
      substanceId: matchedSubstance.id,
      availableCategories: categories,
    };
  }

  const directFoodSearch = await searchByName(parsed.data.query, filters, pagination);
  if (directFoodSearch.totalCount > 0) {
    return {
      results: directFoodSearch.results,
      totalCount: directFoodSearch.totalCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(directFoodSearch.totalCount / pagination.pageSize),
      searchType: "food",
      availableCategories: directFoodSearch.categories,
    };
  }

  const fuzzySubstanceMatch = await findSearchSubstance(parsed.data.query);
  if (fuzzySubstanceMatch) {
    const { results, totalCount, categories } = await searchBySubstance(
      fuzzySubstanceMatch.id,
      filters,
      pagination,
    );
    return {
      results,
      totalCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      searchType: "substance",
      substanceName: fuzzySubstanceMatch.displayName,
      substanceId: fuzzySubstanceMatch.id,
      availableCategories: categories,
    };
  }

  const aiSearchAssist = await generateAiSearchAssist(parsed.data.query);

  for (const term of aiSearchAssist.substanceTerms) {
    const aiSubstanceMatch = await findSearchSubstance(term);
    if (!aiSubstanceMatch) {
      continue;
    }

    const { results, totalCount, categories } = await searchBySubstance(
      aiSubstanceMatch.id,
      filters,
      pagination,
    );
    return {
      results,
      totalCount,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      searchType: "substance",
      substanceName: aiSubstanceMatch.displayName,
      substanceId: aiSubstanceMatch.id,
      availableCategories: categories,
    };
  }

  const assistedFoodSearch = await searchByName(
    parsed.data.query,
    filters,
    pagination,
    aiSearchAssist.foodTerms,
  );
  return {
    results: assistedFoodSearch.results,
    totalCount: assistedFoodSearch.totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(assistedFoodSearch.totalCount / pagination.pageSize),
    searchType: "food",
    availableCategories: assistedFoodSearch.categories,
  };
}

export type AiSearchResult =
  | { status: "found"; foodId: string }
  | { status: "error"; message: string };

/**
 * AI-powered food search: researches a food not in the database,
 * persists it with AI-generated substance data, and returns its ID.
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

  const result = await aiResearchFood(parsed.data.query, session.user.id, {
    source: "app-search",
  });

  if ("error" in result) {
    return { status: "error", message: result.error };
  }

  return { status: "found", foodId: result.foodId };
}

export type AiSubstanceSearchResult =
  | { status: "found"; count: number; summary: string }
  | { status: "error"; message: string };

/**
 * AI-powered substance search: Explorer agent finds data sources (USDA API, web),
 * Parser agent extracts food entries into the DB.
 */
export async function aiDiscoverFoodsBySubstance(
  substanceId: string,
): Promise<AiSubstanceSearchResult> {
  const session = await getSession();

  if (!session) {
    return { status: "error", message: "You must be signed in." };
  }

  const result = await aiSearchBySubstance(substanceId, session.user.id);

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
 * Upload and parse a PDF containing substance data (e.g., USDA reports).
 * Extracts all food entries and adds them to the database.
 */
export async function uploadSubstancePdf(formData: FormData): Promise<PdfUploadResult> {
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
