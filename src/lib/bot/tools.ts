import { randomUUID } from "crypto";
import { and, eq, gte, ilike, inArray, or } from "drizzle-orm";

import {
  calculateSubstanceAmount,
  getConfidenceLabel,
  getSubstanceStatus,
} from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodAliases, foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { consumptionLogs, userSubstanceLimits } from "@/lib/db/schema/users";

export interface ToolContext {
  userId: string;
}

/**
 * Fetch user substance limits via Drizzle.
 * Used internally by tools that need limit context.
 */
async function fetchUserLimits(ctx: ToolContext) {
  return db
    .select({
      substance_id: userSubstanceLimits.substanceId,
      daily_limit: userSubstanceLimits.dailyLimit,
      mode: userSubstanceLimits.mode,
      range_min: userSubstanceLimits.rangeMin,
      range_max: userSubstanceLimits.rangeMax,
    })
    .from(userSubstanceLimits)
    .where(eq(userSubstanceLimits.userId, ctx.userId));
}

/**
 * Build a Map of substance ID -> { dailyLimit, mode } from raw limit rows.
 */
function buildLimitsMap(
  userLimits: Array<{ substance_id: string; daily_limit: string; mode: string }>,
) {
  return new Map(
    userLimits.map((l) => [l.substance_id, { dailyLimit: Number(l.daily_limit), mode: l.mode }]),
  );
}

export async function searchFood(params: { query: string }, _ctx: ToolContext) {
  const searchTerm = `%${params.query.trim()}%`;
  if (!params.query.trim()) {
    return { found: false, message: "Please provide a food name to search for." };
  }
  let matchingFoods;
  try {
    matchingFoods = await db
      .select({
        foodId: foods.id,
        foodName: foods.name,
        category: foods.category,
        variantId: foodVariants.id,
        preparationMethod: foodVariants.preparationMethod,
        isDefault: foodVariants.isDefault,
        servingId: servingMeasures.id,
        servingLabel: servingMeasures.label,
        gramsEquivalent: servingMeasures.gramsEquivalent,
      })
      .from(foods)
      .leftJoin(foodAliases, eq(foodAliases.foodId, foods.id))
      .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
      .leftJoin(servingMeasures, eq(servingMeasures.foodVariantId, foodVariants.id))
      .where(or(ilike(foods.name, searchTerm), ilike(foodAliases.alias, searchTerm)))
      .limit(30);
  } catch (err) {
    console.error("[searchFood] DB query failed:", err);
    return {
      found: false,
      message: `Search failed: ${err instanceof Error ? err.message : "database error"}`,
    };
  }

  if (matchingFoods.length === 0) {
    return { found: false, message: `No foods found matching "${params.query}".` };
  }

  const foodMap = new Map<
    string,
    {
      id: string;
      name: string;
      category: string | null;
      variants: Map<
        string,
        {
          id: string;
          method: string;
          isDefault: boolean;
          servings: Array<{ id: string; label: string; grams: number }>;
        }
      >;
    }
  >();

  for (const row of matchingFoods) {
    if (!foodMap.has(row.foodId)) {
      foodMap.set(row.foodId, {
        id: row.foodId,
        name: row.foodName,
        category: row.category,
        variants: new Map(),
      });
    }
    const food = foodMap.get(row.foodId)!;

    if (row.variantId && !food.variants.has(row.variantId)) {
      food.variants.set(row.variantId, {
        id: row.variantId,
        method: row.preparationMethod ?? "raw",
        isDefault: row.isDefault ?? false,
        servings: [],
      });
    }
    if (row.variantId && row.servingId) {
      const variant = food.variants.get(row.variantId)!;
      if (!variant.servings.some((s) => s.id === row.servingId)) {
        variant.servings.push({
          id: row.servingId!,
          label: row.servingLabel!,
          grams: Number(row.gramsEquivalent),
        });
      }
    }
  }

  return {
    found: true,
    foods: Array.from(foodMap.values()).map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      variants: Array.from(f.variants.values()).map((v) => ({
        id: v.id,
        preparationMethod: v.method,
        isDefault: v.isDefault,
        servings: v.servings,
      })),
    })),
  };
}

export async function getFoodSubstances(params: { foodVariantId: string }, _ctx: ToolContext) {
  const rows = await db
    .select({
      substanceId: resolvedSubstanceValues.substanceId,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      confidenceScore: resolvedSubstanceValues.confidenceScore,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(resolvedSubstanceValues)
    .innerJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(eq(resolvedSubstanceValues.foodVariantId, params.foodVariantId))
    .orderBy(substances.sortOrder);

  return {
    substances: rows.map((r) => ({
      substanceId: r.substanceId,
      displayName: r.displayName,
      unit: r.unit,
      valuePer100g: Number(r.valuePer100g),
      confidenceScore: r.confidenceScore,
      confidenceLabel: getConfidenceLabel(r.confidenceScore ?? 50),
    })),
  };
}

export async function checkCanIEat(
  params: { foodVariantId: string; portionGrams: number },
  ctx: ToolContext,
) {
  // Validate the food variant exists first
  const [variantInfo] = await db
    .select({ foodName: foods.name, method: foodVariants.preparationMethod })
    .from(foodVariants)
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .where(eq(foodVariants.id, params.foodVariantId));

  if (!variantInfo) {
    return {
      error: `Food variant not found (ID: ${params.foodVariantId}). Try searching again.`,
    };
  }

  const userLimits = await fetchUserLimits(ctx);

  // Get today's consumption
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logs = await db
    .select({ substanceSnapshot: consumptionLogs.substanceSnapshot })
    .from(consumptionLogs)
    .where(and(eq(consumptionLogs.userId, ctx.userId), gte(consumptionLogs.loggedAt, today)));

  const todayTotals: Record<string, number> = {};
  for (const log of logs) {
    const snap = log.substanceSnapshot as Record<string, number> | null;
    if (!snap) continue;
    for (const [nId, amt] of Object.entries(snap)) {
      todayTotals[nId] = (todayTotals[nId] ?? 0) + amt;
    }
  }

  // Get substance values for this variant
  const substanceRows = await db
    .select({
      substanceId: resolvedSubstanceValues.substanceId,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(resolvedSubstanceValues)
    .innerJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(eq(resolvedSubstanceValues.foodVariantId, params.foodVariantId))
    .orderBy(substances.sortOrder);

  const limitsMap = buildLimitsMap(userLimits);

  const impact = substanceRows.map((n) => {
    const added = calculateSubstanceAmount(Number(n.valuePer100g), params.portionGrams);
    const consumed = todayTotals[n.substanceId] ?? 0;
    const newTotal = consumed + added;
    const limit = limitsMap.get(n.substanceId);
    const status = getSubstanceStatus(newTotal, limit?.dailyLimit ?? null);
    const pct = limit ? Math.round((newTotal / limit.dailyLimit) * 100) : null;

    return {
      substance: n.displayName,
      unit: n.unit,
      consumedToday: Math.round(consumed * 10) / 10,
      adding: Math.round(added * 10) / 10,
      newTotal: Math.round(newTotal * 10) / 10,
      dailyLimit: limit?.dailyLimit ?? null,
      percentOfLimit: pct,
      status,
    };
  });

  const trackedImpact = impact.filter((i) => i.dailyLimit !== null);
  const hasExceed = trackedImpact.some((i) => i.status === "exceed");
  const hasCaution = trackedImpact.some((i) => i.status === "caution");

  return {
    food: variantInfo?.foodName ?? "Unknown",
    preparationMethod: variantInfo?.method ?? "raw",
    portionGrams: params.portionGrams,
    overallVerdict: hasExceed ? "exceed" : hasCaution ? "caution" : "safe",
    trackedSubstances: trackedImpact,
    allSubstances: impact,
  };
}

export async function recordMeal(
  params: {
    foodVariantId: string;
    servingMeasureId?: string;
    quantity: number;
    portionGrams: number;
    mealLabel?: string;
  },
  ctx: ToolContext,
) {
  // Validate the food variant exists before doing anything
  const [variantInfo] = await db
    .select({ foodName: foods.name, method: foodVariants.preparationMethod })
    .from(foodVariants)
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .where(eq(foodVariants.id, params.foodVariantId));

  if (!variantInfo) {
    console.error("[recordMeal] Food variant not found:", params.foodVariantId);
    return {
      success: false,
      error: `Food variant not found (ID: ${params.foodVariantId}). The food may have been removed. Try searching again.`,
    };
  }

  // Calculate substance snapshot
  const substanceRows = await db
    .select({
      substanceId: resolvedSubstanceValues.substanceId,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
    })
    .from(resolvedSubstanceValues)
    .where(eq(resolvedSubstanceValues.foodVariantId, params.foodVariantId));

  if (substanceRows.length === 0) {
    console.error("[recordMeal] No substance data for variant:", params.foodVariantId);
    return {
      success: false,
      error: `No substance data found for "${variantInfo.foodName}". The food may need to be researched first using aiResearchFood.`,
    };
  }

  const snapshot: Record<string, number> = {};
  for (const row of substanceRows) {
    snapshot[row.substanceId] = calculateSubstanceAmount(
      Number(row.valuePer100g),
      params.portionGrams,
    );
  }

  try {
    await db.insert(consumptionLogs).values({
      id: randomUUID(),
      userId: ctx.userId,
      foodVariantId: params.foodVariantId,
      servingMeasureId: params.servingMeasureId ?? null,
      quantity: String(params.quantity),
      substanceSnapshot: snapshot,
      mealLabel: params.mealLabel ?? null,
    });
  } catch (err) {
    console.error("[recordMeal] DB insert failed:", err);
    return {
      success: false,
      error: `Failed to save meal log: ${err instanceof Error ? err.message : "database error"}`,
    };
  }

  return {
    success: true,
    logged: {
      food: variantInfo.foodName,
      preparationMethod: variantInfo.method,
      quantity: params.quantity,
      portionGrams: params.portionGrams,
      mealLabel: params.mealLabel ?? null,
      substanceCount: Object.keys(snapshot).length,
    },
  };
}

export async function getDailySummary(_params: Record<string, never>, ctx: ToolContext) {
  const userLimits = await fetchUserLimits(ctx);
  const limitSubstanceIds = userLimits.map((l) => l.substance_id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logs = await db
    .select({ substanceSnapshot: consumptionLogs.substanceSnapshot })
    .from(consumptionLogs)
    .where(and(eq(consumptionLogs.userId, ctx.userId), gte(consumptionLogs.loggedAt, today)))
    .orderBy(consumptionLogs.loggedAt);

  const totals: Record<string, number> = {};
  for (const log of logs) {
    const snap = log.substanceSnapshot as Record<string, number> | null;
    if (!snap) continue;
    for (const [nId, amt] of Object.entries(snap)) {
      totals[nId] = (totals[nId] ?? 0) + amt;
    }
  }

  if (limitSubstanceIds.length === 0) {
    return {
      mealCount: logs.length,
      trackedSubstances: [],
      message: "No substance limits configured.",
    };
  }

  const substanceRows = await db
    .select({ id: substances.id, displayName: substances.displayName, unit: substances.unit })
    .from(substances)
    .where(inArray(substances.id, limitSubstanceIds))
    .orderBy(substances.sortOrder);

  const limitsMap = buildLimitsMap(userLimits);

  const summary = substanceRows.map((n) => {
    const total = totals[n.id] ?? 0;
    const limit = limitsMap.get(n.id);
    const pct = limit ? Math.round((total / limit.dailyLimit) * 100) : null;
    return {
      substance: n.displayName,
      unit: n.unit,
      consumed: Math.round(total * 10) / 10,
      dailyLimit: limit?.dailyLimit ?? null,
      percentOfLimit: pct,
      status: getSubstanceStatus(total, limit?.dailyLimit ?? null),
    };
  });

  return {
    mealCount: logs.length,
    trackedSubstances: summary,
  };
}

export async function aiResearchFood(params: { foodName: string }, ctx: ToolContext) {
  try {
    const { aiResearchFood: doResearch } = await import("@/lib/ai/food-search-agent");
    const result = await doResearch(params.foodName, ctx.userId, {
      source: "chat-tool",
    });

    if ("error" in result) {
      console.error("[aiResearchFood] Research failed:", result.error);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      foodId: result.foodId,
      foodName: result.foodName,
      variantsCount: result.variantsCount,
      defaultVariant: result.defaultVariant,
      message: `Successfully researched "${result.foodName}" and saved substance data for immediate use.`,
    };
  } catch (err) {
    console.error("[aiResearchFood] Exception:", err);
    return {
      success: false,
      error: `Failed to research "${params.foodName}": ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
