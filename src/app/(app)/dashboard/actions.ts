"use server";

import type { RecentLogEntry, SubstanceProgress } from "@/types";
import { and, desc, eq, gte } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { getSubstanceStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { substances } from "@/lib/db/schema/substances";
import { consumptionLogs, profiles, userSubstanceLimits } from "@/lib/db/schema/users";

export async function fetchDashboardData(): Promise<{
  substanceProgress: SubstanceProgress[];
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
      substanceProgress: [],
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
        substanceId: userSubstanceLimits.substanceId,
        dailyLimit: userSubstanceLimits.dailyLimit,
        substanceName: substances.name,
        substanceUnit: substances.unit,
        substanceDisplayName: substances.displayName,
        substanceSortOrder: substances.sortOrder,
      })
      .from(userSubstanceLimits)
      .innerJoin(substances, eq(substances.id, userSubstanceLimits.substanceId))
      .where(eq(userSubstanceLimits.userId, userId)),
    db
      .select({ substanceSnapshot: consumptionLogs.substanceSnapshot })
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

  // Aggregate consumed amounts per substance from snapshots
  const consumedBySubstance: Record<string, number> = {};
  for (const log of logs) {
    const snapshot = log.substanceSnapshot as Record<string, number> | null;
    if (!snapshot || typeof snapshot !== "object") continue;
    for (const [substanceId, amount] of Object.entries(snapshot)) {
      consumedBySubstance[substanceId] = (consumedBySubstance[substanceId] ?? 0) + amount;
    }
  }

  // Build progress for each tracked substance
  const substanceProgress: SubstanceProgress[] = limits
    .map((limit) => {
      const dailyLimit = Number(limit.dailyLimit);
      const consumed = consumedBySubstance[limit.substanceId] ?? 0;
      const remaining = Math.max(0, dailyLimit - consumed);
      const percentage = dailyLimit > 0 ? (consumed / dailyLimit) * 100 : 0;

      return {
        substanceId: limit.substanceId,
        name: limit.substanceName,
        displayName: limit.substanceDisplayName,
        unit: limit.substanceUnit,
        dailyLimit,
        consumed,
        remaining,
        percentage,
        status: getSubstanceStatus(consumed, dailyLimit),
        sortOrder: limit.substanceSortOrder ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      substanceId: item.substanceId,
      name: item.name,
      displayName: item.displayName,
      unit: item.unit,
      dailyLimit: item.dailyLimit,
      consumed: item.consumed,
      remaining: item.remaining,
      percentage: item.percentage,
      status: item.status,
    }));

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
    substanceProgress,
    recentLogs: mappedRecent,
    displayName: profile?.firstName ?? profile?.displayName ?? session.user.name ?? null,
    healthGoal: profile?.healthGoal ?? null,
    streakDays,
    todayLogCount: logs.length,
  };
}
