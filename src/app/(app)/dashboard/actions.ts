"use server";

import type { NutrientProgress, RecentLogEntry } from "@/types";

import { getNutrientStatus } from "@/lib/calculations";
import { createClient } from "@/lib/supabase/server";

interface LimitRow {
  nutrient_id: string;
  daily_limit: string;
  nutrients: {
    id: string;
    name: string;
    unit: string;
    display_name: string;
    sort_order: number | null;
  };
}

interface RecentLogRow {
  id: string;
  quantity: string;
  meal_label: string | null;
  logged_at: string;
  serving_measures: { label: string } | null;
  food_variants: {
    preparation_method: string;
    foods: { name: string };
  };
}

export async function fetchDashboardData(): Promise<{
  nutrientProgress: NutrientProgress[];
  recentLogs: RecentLogEntry[];
  displayName: string | null;
  healthGoal: string | null;
  streakDays: number;
  todayLogCount: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Streak: check last 7 days for distinct log dates
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    { data: limits, error: limitsError },
    { data: logs, error: logsError },
    { data: recentLogs, error: recentError },
    { data: profile, error: profileError },
    { data: streakLogs },
  ] = await Promise.all([
    supabase
      .from("user_nutrient_limits")
      .select("nutrient_id, daily_limit, nutrients(id, name, unit, display_name, sort_order)")
      .eq("user_id", user.id),
    supabase
      .from("consumption_logs")
      .select("nutrient_snapshot")
      .eq("user_id", user.id)
      .gte("logged_at", todayStart.toISOString()),
    supabase
      .from("consumption_logs")
      .select(
        "id, quantity, meal_label, logged_at, serving_measures(label), food_variants(preparation_method, foods(name))",
      )
      .eq("user_id", user.id)
      .gte("logged_at", todayStart.toISOString())
      .order("logged_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("first_name, last_name, display_name, health_goal")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("consumption_logs")
      .select("logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", sevenDaysAgo.toISOString())
      .order("logged_at", { ascending: false }),
  ]);

  if (limitsError || logsError || recentError) {
    return {
      nutrientProgress: [],
      recentLogs: [],
      displayName: null,
      healthGoal: null,
      streakDays: 0,
      todayLogCount: 0,
      error: limitsError?.message ?? logsError?.message ?? recentError?.message,
    };
  }

  // Calculate consecutive day streak (including today)
  const logDates = new Set((streakLogs ?? []).map((l) => new Date(l.logged_at).toDateString()));
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
  // Snapshots are stored as Record<string, number> (nutrientId → amount)
  const consumedByNutrient: Record<string, number> = {};
  for (const log of logs ?? []) {
    const snapshot = log.nutrient_snapshot as Record<string, number> | null;
    if (!snapshot || typeof snapshot !== "object") continue;
    for (const [nutrientId, amount] of Object.entries(snapshot)) {
      consumedByNutrient[nutrientId] = (consumedByNutrient[nutrientId] ?? 0) + amount;
    }
  }

  // Build progress for each tracked nutrient
  const nutrientProgress: NutrientProgress[] = ((limits ?? []) as unknown as LimitRow[])
    .map((limit) => {
      const nutrient = limit.nutrients;
      const dailyLimit = Number(limit.daily_limit);
      const consumed = consumedByNutrient[nutrient.id] ?? 0;
      const remaining = Math.max(0, dailyLimit - consumed);
      const percentage = dailyLimit > 0 ? (consumed / dailyLimit) * 100 : 0;

      return {
        nutrientId: nutrient.id,
        name: nutrient.name,
        displayName: nutrient.display_name,
        unit: nutrient.unit,
        dailyLimit,
        consumed,
        remaining,
        percentage,
        status: getNutrientStatus(consumed, dailyLimit),
        sortOrder: nutrient.sort_order ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);

  // Map recent logs
  const mappedRecent: RecentLogEntry[] = ((recentLogs ?? []) as unknown as RecentLogRow[]).map(
    (log) => ({
      id: log.id,
      foodName: log.food_variants.foods.name,
      preparationMethod: log.food_variants.preparation_method,
      quantity: log.quantity,
      servingLabel: log.serving_measures?.label ?? null,
      mealLabel: log.meal_label,
      loggedAt: log.logged_at,
    }),
  );

  return {
    nutrientProgress,
    recentLogs: mappedRecent,
    displayName:
      profile?.first_name ??
      profile?.display_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    healthGoal: profile?.health_goal ?? null,
    streakDays,
    todayLogCount: (logs ?? []).length,
  };
}
