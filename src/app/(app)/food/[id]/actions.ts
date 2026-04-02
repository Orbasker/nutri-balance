"use server";

import { revalidatePath } from "next/cache";

import type { FoodDetail, FoodVariantDetail, SubstanceDetail, SubstanceImpact } from "@/types";
import { and, count, eq, gte } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import {
  calculateSubstanceAmount,
  getConfidenceLabel,
  getSubstanceStatus,
} from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { consumptionLogs, userSubstanceLimits } from "@/lib/db/schema/users";
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
      substanceId: substances.id,
      substanceName: substances.name,
      substanceDisplayName: substances.displayName,
      substanceUnit: substances.unit,
      substanceCategory: substances.category,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      confidenceScore: resolvedSubstanceValues.confidenceScore,
      sourceSummary: resolvedSubstanceValues.sourceSummary,
      substanceSortOrder: substances.sortOrder,
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(servingMeasures, eq(servingMeasures.foodVariantId, foodVariants.id))
    .leftJoin(resolvedSubstanceValues, eq(resolvedSubstanceValues.foodVariantId, foodVariants.id))
    .leftJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(eq(foods.id, foodId))
    .orderBy(substances.sortOrder);

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
        substances: [],
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

    if (row.substanceId && !variant.substances.some((n) => n.substanceId === row.substanceId)) {
      const score = row.confidenceScore ?? 50;
      variant.substances.push({
        substanceId: row.substanceId,
        name: row.substanceName!,
        displayName: row.substanceDisplayName!,
        unit: row.substanceUnit!,
        category: (row.substanceCategory as SubstanceDetail["category"]) ?? "other",
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
    .select({ substanceSnapshot: consumptionLogs.substanceSnapshot })
    .from(consumptionLogs)
    .where(and(eq(consumptionLogs.userId, session.user.id), gte(consumptionLogs.loggedAt, today)));

  const totals: Record<string, number> = {};
  for (const log of logs) {
    const snapshot = log.substanceSnapshot as Record<string, number> | null;
    if (!snapshot) continue;
    for (const [substanceId, amount] of Object.entries(snapshot)) {
      totals[substanceId] = (totals[substanceId] ?? 0) + amount;
    }
  }
  return totals;
}

export async function getUserSubstanceLimits(): Promise<
  Array<{
    substanceId: string;
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
      substanceId: userSubstanceLimits.substanceId,
      dailyLimit: userSubstanceLimits.dailyLimit,
      mode: userSubstanceLimits.mode,
      rangeMin: userSubstanceLimits.rangeMin,
      rangeMax: userSubstanceLimits.rangeMax,
    })
    .from(userSubstanceLimits)
    .where(eq(userSubstanceLimits.userId, session.user.id));

  return data.map((row) => ({
    substanceId: row.substanceId,
    dailyLimit: Number(row.dailyLimit),
    mode: row.mode as "strict" | "stability",
    rangeMin: row.rangeMin ? Number(row.rangeMin) : null,
    rangeMax: row.rangeMax ? Number(row.rangeMax) : null,
  }));
}

export async function calculateImpact(
  substanceDetails: SubstanceDetail[],
  portionGrams: number,
  todaysConsumption: Record<string, number>,
  userLimits: Array<{
    substanceId: string;
    dailyLimit: number;
    mode: "strict" | "stability";
    rangeMin: number | null;
    rangeMax: number | null;
  }>,
): Promise<SubstanceImpact[]> {
  const limitsMap = new Map(userLimits.map((l) => [l.substanceId, l]));

  return substanceDetails.map((n) => {
    const addedAmount = calculateSubstanceAmount(n.valuePer100g, portionGrams);
    const consumedToday = todaysConsumption[n.substanceId] ?? 0;
    const newTotal = consumedToday + addedAmount;
    const limit = limitsMap.get(n.substanceId);

    return {
      substanceId: n.substanceId,
      displayName: n.displayName,
      unit: n.unit,
      consumedToday,
      addedAmount,
      newTotal,
      dailyLimit: limit?.dailyLimit ?? null,
      mode: limit?.mode ?? null,
      rangeMin: limit?.rangeMin ?? null,
      rangeMax: limit?.rangeMax ?? null,
      status: getSubstanceStatus(newTotal, limit?.dailyLimit ?? null),
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
    substanceSnapshot: parsed.data.substanceSnapshot,
    mealLabel: parsed.data.mealLabel ?? null,
  });

  revalidatePath(`/food`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

export async function getTotalSubstanceCount(): Promise<number> {
  const [result] = await db.select({ count: count() }).from(substances);
  return Number(result?.count ?? 0);
}

export async function enrichFoodWithAi(
  foodId: string,
  foodVariantId: string,
): Promise<{ ok: true; enriched: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  // Dynamically import to keep the main actions bundle lean
  const { enrichFoodVariant } = await import("@/lib/ai/food-enricher");
  const result = await enrichFoodVariant(foodId, foodVariantId, session.user.id);

  revalidatePath(`/food/${foodId}`);
  return result;
}
