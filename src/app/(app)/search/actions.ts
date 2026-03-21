"use server";

import type { FoodSearchResult } from "@/types";
import { eq, ilike, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodAliases, foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { searchInputSchema } from "@/lib/validators";

import { type SearchRow, mapSearchRows } from "./search-utils";

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const parsed = searchInputSchema.safeParse({ query });
  if (!parsed.success) {
    return [];
  }

  const searchTerm = `%${parsed.data.query}%`;

  // Find food IDs matching name or alias
  const matchingFoodIds = db
    .select({ id: foods.id })
    .from(foods)
    .leftJoin(foodAliases, eq(foodAliases.foodId, foods.id))
    .where(or(ilike(foods.name, searchTerm), ilike(foodAliases.alias, searchTerm)))
    .groupBy(foods.id);

  // Join with variants and resolved nutrient values
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
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
    .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(inArray(foods.id, matchingFoodIds))
    .orderBy(foods.name);

  return mapSearchRows(rows as SearchRow[]);
}
