"use server";

import { revalidatePath } from "next/cache";

import type { FoodDetail, FoodVariantDetail, NutrientDetail, NutrientImpact } from "@/types";
import { sql } from "drizzle-orm";

import { calculateNutrientAmount, getConfidenceLabel, getNutrientStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { createClient } from "@/lib/supabase/server";
import { addConsumptionLogSchema } from "@/lib/validators";

export async function getFoodDetail(foodId: string): Promise<FoodDetail | null> {
  const rows = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      description: foods.description,
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      variantDescription: foodVariants.description,
      isDefault: foodVariants.isDefault,
      servingId: servingMeasures.id,
      servingLabel: servingMeasures.label,
      gramsEquivalent: servingMeasures.gramsEquivalent,
      nutrientId: nutrients.id,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      nutrientUnit: nutrients.unit,
      valuePer100g: resolvedNutrientValues.valuePer100g,
      confidenceScore: resolvedNutrientValues.confidenceScore,
      sourceSummary: resolvedNutrientValues.sourceSummary,
      nutrientSortOrder: nutrients.sortOrder,
    })
    .from(foods)
    .leftJoin(foodVariants, sql`${foodVariants.foodId} = ${foods.id}`)
    .leftJoin(servingMeasures, sql`${servingMeasures.foodVariantId} = ${foodVariants.id}`)
    .leftJoin(
      resolvedNutrientValues,
      sql`${resolvedNutrientValues.foodVariantId} = ${foodVariants.id}`,
    )
    .leftJoin(nutrients, sql`${nutrients.id} = ${resolvedNutrientValues.nutrientId}`)
    .where(sql`${foods.id} = ${foodId}`)
    .orderBy(nutrients.sortOrder);

  if (rows.length === 0) return null;

  const first = rows[0];
  const variantMap = new Map<string, FoodVariantDetail>();

  for (const row of rows) {
    if (!row.variantId) continue;

    let variant = variantMap.get(row.variantId);
    if (!variant) {
      variant = {
        id: row.variantId,
        preparationMethod: row.preparationMethod!,
        description: row.variantDescription ?? null,
        isDefault: row.isDefault ?? false,
        servingMeasures: [],
        nutrients: [],
      };
      variantMap.set(row.variantId, variant);
    }

    if (row.servingId && !variant.servingMeasures.some((s) => s.id === row.servingId)) {
      variant.servingMeasures.push({
        id: row.servingId,
        label: row.servingLabel!,
        gramsEquivalent: Number(row.gramsEquivalent),
      });
    }

    if (row.nutrientId && !variant.nutrients.some((n) => n.nutrientId === row.nutrientId)) {
      const score = row.confidenceScore ?? 50;
      variant.nutrients.push({
        nutrientId: row.nutrientId,
        name: row.nutrientName!,
        displayName: row.nutrientDisplayName!,
        unit: row.nutrientUnit!,
        valuePer100g: Number(row.valuePer100g),
        confidenceScore: score,
        confidenceLabel: getConfidenceLabel(score),
        sourceSummary: row.sourceSummary ?? null,
      });
    }
  }

  return {
    id: first.foodId,
    name: first.foodName,
    category: first.category ?? null,
    description: first.description ?? null,
    variants: Array.from(variantMap.values()),
  };
}

export async function getTodaysConsumption(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const { data: logs } = await supabase
    .from("consumption_logs")
    .select("nutrient_snapshot")
    .eq("user_id", user.id)
    .gte("logged_at", todayStr);

  if (!logs) return {};

  const totals: Record<string, number> = {};
  for (const log of logs) {
    const snapshot = log.nutrient_snapshot as Record<string, number> | null;
    if (!snapshot) continue;
    for (const [nutrientId, amount] of Object.entries(snapshot)) {
      totals[nutrientId] = (totals[nutrientId] ?? 0) + amount;
    }
  }
  return totals;
}

export async function getUserNutrientLimits(): Promise<
  Array<{
    nutrientId: string;
    dailyLimit: number;
    mode: "strict" | "stability";
    rangeMin: number | null;
    rangeMax: number | null;
  }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("user_nutrient_limits")
    .select("nutrient_id, daily_limit, mode, range_min, range_max")
    .eq("user_id", user.id);

  if (!data) return [];

  return data.map((row) => ({
    nutrientId: row.nutrient_id,
    dailyLimit: Number(row.daily_limit),
    mode: row.mode as "strict" | "stability",
    rangeMin: row.range_min ? Number(row.range_min) : null,
    rangeMax: row.range_max ? Number(row.range_max) : null,
  }));
}

export async function calculateImpact(
  nutrientDetails: NutrientDetail[],
  portionGrams: number,
  todaysConsumption: Record<string, number>,
  userLimits: Array<{
    nutrientId: string;
    dailyLimit: number;
    mode: "strict" | "stability";
    rangeMin: number | null;
    rangeMax: number | null;
  }>,
): Promise<NutrientImpact[]> {
  const limitsMap = new Map(userLimits.map((l) => [l.nutrientId, l]));

  return nutrientDetails.map((n) => {
    const addedAmount = calculateNutrientAmount(n.valuePer100g, portionGrams);
    const consumedToday = todaysConsumption[n.nutrientId] ?? 0;
    const newTotal = consumedToday + addedAmount;
    const limit = limitsMap.get(n.nutrientId);

    return {
      nutrientId: n.nutrientId,
      displayName: n.displayName,
      unit: n.unit,
      consumedToday,
      addedAmount,
      newTotal,
      dailyLimit: limit?.dailyLimit ?? null,
      mode: limit?.mode ?? null,
      rangeMin: limit?.rangeMin ?? null,
      rangeMax: limit?.rangeMax ?? null,
      status: getNutrientStatus(newTotal, limit?.dailyLimit ?? null),
    };
  });
}

export type AddToTodayResult = { ok: true } | { error: string };

export async function addToToday(raw: unknown): Promise<AddToTodayResult> {
  const parsed = addConsumptionLogSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("consumption_logs").insert({
    user_id: user.id,
    food_variant_id: parsed.data.foodVariantId,
    serving_measure_id: parsed.data.servingMeasureId,
    quantity: String(parsed.data.quantity),
    nutrient_snapshot: parsed.data.nutrientSnapshot,
    meal_label: parsed.data.mealLabel ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/food`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}
