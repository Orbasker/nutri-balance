"use server";

import { revalidatePath } from "next/cache";

import type { DailyNutrientTotal, LogEntry, LogEntryNutrientInfo } from "@/types";
import { sql } from "drizzle-orm";

import { getNutrientStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { createClient } from "@/lib/supabase/server";
import { deleteConsumptionLogSchema, updateConsumptionLogSchema } from "@/lib/validators";

export type LogActionResult = { ok: true } | { error: string };

/**
 * Fetch all consumption log entries for a given date, joined with food/variant names.
 */
export async function getLogEntries(dateStr: string): Promise<LogEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const { data: logs } = await supabase
    .from("consumption_logs")
    .select(
      "id, food_variant_id, quantity, nutrient_snapshot, logged_at, meal_label, serving_measure_id",
    )
    .eq("user_id", user.id)
    .gte("logged_at", startOfDay)
    .lte("logged_at", endOfDay)
    .order("logged_at", { ascending: true });

  if (!logs || logs.length === 0) return [];

  // Gather variant IDs and serving measure IDs for batch lookup
  const variantIds = [...new Set(logs.map((l) => l.food_variant_id))];
  const servingIds = [
    ...new Set(logs.map((l) => l.serving_measure_id).filter(Boolean)),
  ] as string[];

  // Batch fetch variant + food info
  const variantRows = await db
    .select({
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      foodName: foods.name,
    })
    .from(foodVariants)
    .innerJoin(foods, sql`${foods.id} = ${foodVariants.foodId}`)
    .where(sql`${foodVariants.id} IN ${variantIds}`);

  const variantMap = new Map(variantRows.map((r) => [r.variantId, r]));

  // Batch fetch serving measures
  let servingMap = new Map<string, string>();
  if (servingIds.length > 0) {
    const servingRows = await db
      .select({ id: servingMeasures.id, label: servingMeasures.label })
      .from(servingMeasures)
      .where(sql`${servingMeasures.id} IN ${servingIds}`);
    servingMap = new Map(servingRows.map((r) => [r.id, r.label]));
  }

  return logs.map((log) => {
    const variant = variantMap.get(log.food_variant_id);
    return {
      id: log.id,
      foodVariantId: log.food_variant_id,
      foodName: variant?.foodName ?? "Unknown food",
      preparationMethod: variant?.preparationMethod ?? "raw",
      quantity: Number(log.quantity),
      servingLabel: log.serving_measure_id
        ? (servingMap.get(log.serving_measure_id) ?? null)
        : null,
      mealLabel: log.meal_label,
      loggedAt: log.logged_at,
      nutrientSnapshot: (log.nutrient_snapshot as Record<string, number>) ?? {},
    };
  });
}

/**
 * Get nutrient display info (name, unit) for nutrient IDs found in snapshots.
 */
export async function getNutrientInfo(nutrientIds: string[]): Promise<LogEntryNutrientInfo[]> {
  if (nutrientIds.length === 0) return [];

  const rows = await db
    .select({
      id: nutrients.id,
      displayName: nutrients.displayName,
      unit: nutrients.unit,
    })
    .from(nutrients)
    .where(sql`${nutrients.id} IN ${nutrientIds}`)
    .orderBy(nutrients.sortOrder);

  return rows.map((r) => ({
    nutrientId: r.id,
    displayName: r.displayName!,
    unit: r.unit,
  }));
}

/**
 * Get user nutrient limits and compute daily totals from log entries.
 */
export async function getDailySummary(entries: LogEntry[]): Promise<DailyNutrientTotal[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Aggregate totals from all entries
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    for (const [nutrientId, amount] of Object.entries(entry.nutrientSnapshot)) {
      totals[nutrientId] = (totals[nutrientId] ?? 0) + amount;
    }
  }

  // Fetch user limits
  const { data: limits } = await supabase
    .from("user_nutrient_limits")
    .select("nutrient_id, daily_limit, mode")
    .eq("user_id", user.id);

  if (!limits || limits.length === 0) return [];

  const limitNutrientIds = limits.map((l) => l.nutrient_id);

  // Fetch nutrient display info for tracked nutrients
  const nutrientRows = await db
    .select({
      id: nutrients.id,
      displayName: nutrients.displayName,
      unit: nutrients.unit,
    })
    .from(nutrients)
    .where(sql`${nutrients.id} IN ${limitNutrientIds}`)
    .orderBy(nutrients.sortOrder);

  const nutrientMap = new Map(nutrientRows.map((r) => [r.id, r]));

  const result: DailyNutrientTotal[] = [];
  for (const limit of limits) {
    const nutrient = nutrientMap.get(limit.nutrient_id);
    if (!nutrient) continue;

    const total = totals[limit.nutrient_id] ?? 0;
    const dailyLimit = Number(limit.daily_limit);

    result.push({
      nutrientId: limit.nutrient_id,
      displayName: nutrient.displayName!,
      unit: nutrient.unit,
      total,
      dailyLimit,
      mode: limit.mode as "strict" | "stability" | null,
      status: getNutrientStatus(total, dailyLimit),
    });
  }
  return result;
}

/**
 * Get resolved nutrient values for a food variant (for recalculating on edit).
 */
export async function getVariantNutrientValues(
  foodVariantId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      nutrientId: resolvedNutrientValues.nutrientId,
      valuePer100g: resolvedNutrientValues.valuePer100g,
    })
    .from(resolvedNutrientValues)
    .where(sql`${resolvedNutrientValues.foodVariantId} = ${foodVariantId}`);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.nutrientId] = Number(row.valuePer100g);
  }
  return result;
}

/**
 * Delete a consumption log entry.
 */
export async function deleteLogEntry(raw: unknown): Promise<LogActionResult> {
  const parsed = deleteConsumptionLogSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid log ID." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("consumption_logs")
    .delete()
    .eq("id", parsed.data.logId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/food");
  return { ok: true };
}

/**
 * Update a consumption log entry's quantity and recalculate nutrient snapshot.
 */
export async function updateLogEntry(raw: unknown): Promise<LogActionResult> {
  const parsed = updateConsumptionLogSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("consumption_logs")
    .update({
      quantity: String(parsed.data.quantity),
      nutrient_snapshot: parsed.data.nutrientSnapshot,
    })
    .eq("id", parsed.data.logId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/food");
  return { ok: true };
}
