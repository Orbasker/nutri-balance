"use server";

import { revalidatePath } from "next/cache";

import type { FoodDetail, FoodVariantDetail, NutrientDetail, NutrientImpact } from "@/types";
import { and, eq, gte } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { calculateNutrientAmount, getConfidenceLabel, getNutrientStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { consumptionLogs, userNutrientLimits } from "@/lib/db/schema/users";
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
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(servingMeasures, eq(servingMeasures.foodVariantId, foodVariants.id))
    .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
    .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(eq(foods.id, foodId))
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
  const session = await getSession();
  if (!session) return {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logs = await db
    .select({ nutrientSnapshot: consumptionLogs.nutrientSnapshot })
    .from(consumptionLogs)
    .where(and(eq(consumptionLogs.userId, session.user.id), gte(consumptionLogs.loggedAt, today)));

  const totals: Record<string, number> = {};
  for (const log of logs) {
    const snapshot = log.nutrientSnapshot as Record<string, number> | null;
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
  const session = await getSession();
  if (!session) return [];

  const data = await db
    .select({
      nutrientId: userNutrientLimits.nutrientId,
      dailyLimit: userNutrientLimits.dailyLimit,
      mode: userNutrientLimits.mode,
      rangeMin: userNutrientLimits.rangeMin,
      rangeMax: userNutrientLimits.rangeMax,
    })
    .from(userNutrientLimits)
    .where(eq(userNutrientLimits.userId, session.user.id));

  return data.map((row) => ({
    nutrientId: row.nutrientId,
    dailyLimit: Number(row.dailyLimit),
    mode: row.mode as "strict" | "stability",
    rangeMin: row.rangeMin ? Number(row.rangeMin) : null,
    rangeMax: row.rangeMax ? Number(row.rangeMax) : null,
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

  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  await db.insert(consumptionLogs).values({
    userId: session.user.id,
    foodVariantId: parsed.data.foodVariantId,
    servingMeasureId: parsed.data.servingMeasureId,
    quantity: String(parsed.data.quantity),
    nutrientSnapshot: parsed.data.nutrientSnapshot,
    mealLabel: parsed.data.mealLabel ?? null,
  });

  revalidatePath(`/food`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}
