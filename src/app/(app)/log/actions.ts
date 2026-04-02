"use server";

import { revalidatePath } from "next/cache";

import type { DailySubstanceTotal, LogEntry, LogEntrySubstanceInfo } from "@/types";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { getSubstanceStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { consumptionLogs, userSubstanceLimits } from "@/lib/db/schema/users";
import { deleteConsumptionLogSchema, updateConsumptionLogSchema } from "@/lib/validators";

export type LogActionResult = { ok: true } | { error: string };

/**
 * Fetch all consumption log entries for a given date, joined with food/variant names.
 */
export async function getLogEntries(dateStr: string): Promise<LogEntry[]> {
  const session = await getSession();
  if (!session) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const logs = await db
    .select({
      id: consumptionLogs.id,
      foodVariantId: consumptionLogs.foodVariantId,
      quantity: consumptionLogs.quantity,
      substanceSnapshot: consumptionLogs.substanceSnapshot,
      loggedAt: consumptionLogs.loggedAt,
      mealLabel: consumptionLogs.mealLabel,
      servingMeasureId: consumptionLogs.servingMeasureId,
    })
    .from(consumptionLogs)
    .where(
      and(
        eq(consumptionLogs.userId, session.user.id),
        gte(consumptionLogs.loggedAt, startOfDay),
        lte(consumptionLogs.loggedAt, endOfDay),
      ),
    )
    .orderBy(consumptionLogs.loggedAt);

  if (logs.length === 0) return [];

  // Gather variant IDs and serving measure IDs for batch lookup
  const variantIds = [...new Set(logs.map((l) => l.foodVariantId))];
  const servingIds = [...new Set(logs.map((l) => l.servingMeasureId).filter(Boolean))] as string[];

  // Batch fetch variant + food info
  const variantRows = await db
    .select({
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      foodName: foods.name,
    })
    .from(foodVariants)
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .where(inArray(foodVariants.id, variantIds));

  const variantMap = new Map(variantRows.map((r) => [r.variantId, r]));

  // Batch fetch serving measures
  let servingMap = new Map<string, string>();
  if (servingIds.length > 0) {
    const servingRows = await db
      .select({ id: servingMeasures.id, label: servingMeasures.label })
      .from(servingMeasures)
      .where(inArray(servingMeasures.id, servingIds));
    servingMap = new Map(servingRows.map((r) => [r.id, r.label]));
  }

  return logs.map((log) => {
    const variant = variantMap.get(log.foodVariantId);
    return {
      id: log.id,
      foodVariantId: log.foodVariantId,
      foodName: variant?.foodName ?? "Unknown food",
      preparationMethod: variant?.preparationMethod ?? "raw",
      quantity: Number(log.quantity),
      servingLabel: log.servingMeasureId ? (servingMap.get(log.servingMeasureId) ?? null) : null,
      mealLabel: log.mealLabel,
      loggedAt: log.loggedAt.toISOString(),
      substanceSnapshot: (log.substanceSnapshot as Record<string, number>) ?? {},
    };
  });
}

/**
 * Get substance display info (name, unit) for substance IDs found in snapshots.
 */
export async function getSubstanceInfo(substanceIds: string[]): Promise<LogEntrySubstanceInfo[]> {
  if (substanceIds.length === 0) return [];

  const rows = await db
    .select({
      id: substances.id,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(substances)
    .where(inArray(substances.id, substanceIds))
    .orderBy(substances.sortOrder);

  return rows.map((r) => ({
    substanceId: r.id,
    displayName: r.displayName!,
    unit: r.unit,
  }));
}

/**
 * Get user substance limits and compute daily totals from log entries.
 */
export async function getDailySummary(entries: LogEntry[]): Promise<DailySubstanceTotal[]> {
  const session = await getSession();
  if (!session) return [];

  // Aggregate totals from all entries
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    for (const [substanceId, amount] of Object.entries(entry.substanceSnapshot)) {
      totals[substanceId] = (totals[substanceId] ?? 0) + amount;
    }
  }

  // Fetch user limits
  const limits = await db
    .select({
      substanceId: userSubstanceLimits.substanceId,
      dailyLimit: userSubstanceLimits.dailyLimit,
      mode: userSubstanceLimits.mode,
    })
    .from(userSubstanceLimits)
    .where(eq(userSubstanceLimits.userId, session.user.id));

  if (limits.length === 0) return [];

  const limitSubstanceIds = limits.map((l) => l.substanceId);

  // Fetch substance display info for tracked substances
  const substanceRows = await db
    .select({
      id: substances.id,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(substances)
    .where(inArray(substances.id, limitSubstanceIds))
    .orderBy(substances.sortOrder);

  const substanceMap = new Map(substanceRows.map((r) => [r.id, r]));

  const result: DailySubstanceTotal[] = [];
  for (const limit of limits) {
    const substance = substanceMap.get(limit.substanceId);
    if (!substance) continue;

    const total = totals[limit.substanceId] ?? 0;
    const dailyLimit = Number(limit.dailyLimit);

    result.push({
      substanceId: limit.substanceId,
      displayName: substance.displayName!,
      unit: substance.unit,
      total,
      dailyLimit,
      mode: limit.mode as "strict" | "stability" | null,
      status: getSubstanceStatus(total, dailyLimit),
    });
  }
  return result;
}

/**
 * Get resolved substance values for a food variant (for recalculating on edit).
 */
export async function getVariantSubstanceValues(
  foodVariantId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      substanceId: resolvedSubstanceValues.substanceId,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
    })
    .from(resolvedSubstanceValues)
    .where(eq(resolvedSubstanceValues.foodVariantId, foodVariantId));

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.substanceId] = Number(row.valuePer100g);
  }
  return result;
}

/**
 * Delete a consumption log entry.
 */
export async function deleteLogEntry(raw: unknown): Promise<LogActionResult> {
  const parsed = deleteConsumptionLogSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid log ID." };

  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  await db
    .delete(consumptionLogs)
    .where(
      and(eq(consumptionLogs.id, parsed.data.logId), eq(consumptionLogs.userId, session.user.id)),
    );

  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/food");
  return { ok: true };
}

/**
 * Update a consumption log entry's quantity and recalculate substance snapshot.
 */
export async function updateLogEntry(raw: unknown): Promise<LogActionResult> {
  const parsed = updateConsumptionLogSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  await db
    .update(consumptionLogs)
    .set({
      quantity: String(parsed.data.quantity),
      substanceSnapshot: parsed.data.substanceSnapshot,
    })
    .where(
      and(eq(consumptionLogs.id, parsed.data.logId), eq(consumptionLogs.userId, session.user.id)),
    );

  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/food");
  return { ok: true };
}
