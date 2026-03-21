"use server";

import type { FoodSearchResult } from "@/types";
import { ilike, or, sql } from "drizzle-orm";

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
    .leftJoin(foodAliases, sql`${foodAliases.foodId} = ${foods.id}`)
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
    .leftJoin(foodVariants, sql`${foodVariants.foodId} = ${foods.id}`)
    .leftJoin(
      resolvedNutrientValues,
      sql`${resolvedNutrientValues.foodVariantId} = ${foodVariants.id}`,
    )
    .leftJoin(nutrients, sql`${nutrients.id} = ${resolvedNutrientValues.nutrientId}`)
    .where(sql`${foods.id} IN (${matchingFoodIds})`)
    .orderBy(foods.name);

  return mapSearchRows(rows as SearchRow[]);
}
