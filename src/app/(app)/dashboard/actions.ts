"use server";

import type { NutrientProgress, RecentLogEntry } from "@/types";
import { and, desc, eq, gte } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { getNutrientStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { consumptionLogs, profiles, userNutrientLimits } from "@/lib/db/schema/users";

export async function fetchDashboardData(): Promise<{
  nutrientProgress: NutrientProgress[];
  recentLogs: RecentLogEntry[];
  displayName: string | null;
  healthGoal: string | null;
  streakDays: number;
  todayLogCount: number;
  error?: string;
}> {
  const session = await getSession();

  if (!session) {
    return {
      nutrientProgress: [],
      recentLogs: [],
      displayName: null,
      healthGoal: null,
      streakDays: 0,
      todayLogCount: 0,
      error: "Not authenticated",
    };
  }

  const userId = session.user.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [limits, logs, recentLogs, profile, streakLogs] = await Promise.all([
    db
      .select({
        nutrientId: userNutrientLimits.nutrientId,
        dailyLimit: userNutrientLimits.dailyLimit,
        nutrientName: nutrients.name,
        nutrientUnit: nutrients.unit,
        nutrientDisplayName: nutrients.displayName,
        nutrientSortOrder: nutrients.sortOrder,
      })
      .from(userNutrientLimits)
      .innerJoin(nutrients, eq(nutrients.id, userNutrientLimits.nutrientId))
      .where(eq(userNutrientLimits.userId, userId)),
    db
      .select({ nutrientSnapshot: consumptionLogs.nutrientSnapshot })
      .from(consumptionLogs)
      .where(and(eq(consumptionLogs.userId, userId), gte(consumptionLogs.loggedAt, todayStart))),
    db
      .select({
        id: consumptionLogs.id,
        quantity: consumptionLogs.quantity,
        mealLabel: consumptionLogs.mealLabel,
        loggedAt: consumptionLogs.loggedAt,
        servingLabel: servingMeasures.label,
        foodName: foods.name,
        preparationMethod: foodVariants.preparationMethod,
      })
      .from(consumptionLogs)
      .innerJoin(foodVariants, eq(foodVariants.id, consumptionLogs.foodVariantId))
      .innerJoin(foods, eq(foods.id, foodVariants.foodId))
      .leftJoin(servingMeasures, eq(servingMeasures.id, consumptionLogs.servingMeasureId))
      .where(and(eq(consumptionLogs.userId, userId), gte(consumptionLogs.loggedAt, todayStart)))
      .orderBy(desc(consumptionLogs.loggedAt))
      .limit(5),
    db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        displayName: profiles.displayName,
        healthGoal: profiles.healthGoal,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .then((rows) => rows[0] ?? null),
    db
      .select({ loggedAt: consumptionLogs.loggedAt })
      .from(consumptionLogs)
      .where(and(eq(consumptionLogs.userId, userId), gte(consumptionLogs.loggedAt, sevenDaysAgo)))
      .orderBy(desc(consumptionLogs.loggedAt)),
  ]);

  // Calculate consecutive day streak (including today)
  const logDates = new Set(streakLogs.map((l) => new Date(l.loggedAt).toDateString()));
  let streakDays = 0;
  const cursor = new Date();
  for (let i = 0; i < 7; i++) {
    if (logDates.has(cursor.toDateString())) {
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Aggregate consumed amounts per nutrient from snapshots
  const consumedByNutrient: Record<string, number> = {};
  for (const log of logs) {
    const snapshot = log.nutrientSnapshot as Record<string, number> | null;
    if (!snapshot || typeof snapshot !== "object") continue;
    for (const [nutrientId, amount] of Object.entries(snapshot)) {
      consumedByNutrient[nutrientId] = (consumedByNutrient[nutrientId] ?? 0) + amount;
    }
  }

  // Build progress for each tracked nutrient
  const nutrientProgress: NutrientProgress[] = limits
    .map((limit) => {
      const dailyLimit = Number(limit.dailyLimit);
      const consumed = consumedByNutrient[limit.nutrientId] ?? 0;
      const remaining = Math.max(0, dailyLimit - consumed);
      const percentage = dailyLimit > 0 ? (consumed / dailyLimit) * 100 : 0;

      return {
        nutrientId: limit.nutrientId,
        name: limit.nutrientName,
        displayName: limit.nutrientDisplayName,
        unit: limit.nutrientUnit,
        dailyLimit,
        consumed,
        remaining,
        percentage,
        status: getNutrientStatus(consumed, dailyLimit),
        sortOrder: limit.nutrientSortOrder ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);

  // Map recent logs
  const mappedRecent: RecentLogEntry[] = recentLogs.map((log) => ({
    id: log.id,
    foodName: log.foodName,
    preparationMethod: log.preparationMethod,
    quantity: log.quantity,
    servingLabel: log.servingLabel ?? null,
    mealLabel: log.mealLabel,
    loggedAt: log.loggedAt.toISOString(),
  }));

  return {
    nutrientProgress,
    recentLogs: mappedRecent,
    displayName: profile?.firstName ?? profile?.displayName ?? session.user.name ?? null,
    healthGoal: profile?.healthGoal ?? null,
    streakDays,
    todayLogCount: logs.length,
  };
}
