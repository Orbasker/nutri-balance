import Link from "next/link";

import type { NutrientProgress, RecentLogEntry } from "@/types";

import { fetchDashboardData } from "./actions";

function formatAmount(value: number, unit: string): string {
  if (unit === "mcg" || value >= 100) return `${Math.round(value)}${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getInsightMessage(nutrients: NutrientProgress[], todayLogCount: number): string {
  if (nutrients.length === 0) return "Set up your nutrient limits to start tracking.";
  if (todayLogCount === 0) return "Log your first meal to see how your day shapes up.";

  const exceeded = nutrients.filter((n) => n.status === "exceed");
  const caution = nutrients.filter((n) => n.status === "caution");

  if (exceeded.length > 0) {
    const names = exceeded.map((n) => n.displayName).join(", ");
    return `${names} ${exceeded.length === 1 ? "has" : "have"} exceeded your daily limit. Consider adjusting your next meal.`;
  }
  if (caution.length > 0) {
    const names = caution.map((n) => n.displayName).join(", ");
    return `${names} approaching your limit — choose carefully for the rest of the day.`;
  }

  const avgPct = nutrients.reduce((s, n) => s + n.percentage, 0) / nutrients.length;
  if (avgPct < 20) return "Just getting started — plenty of room for your meals today.";
  if (avgPct < 50) return "Looking good so far. You have room for a full meal.";
  return "All nutrients within safe range. Great balance today!";
}

function getOverallStatus(nutrients: NutrientProgress[]): {
  label: string;
  icon: string;
  color: string;
} {
  if (nutrients.length === 0)
    return { label: "No limits set", icon: "tune", color: "text-blue-100/60" };

  const exceeded = nutrients.filter((n) => n.status === "exceed").length;
  const cautionCount = nutrients.filter((n) => n.status === "caution").length;

  if (exceeded > 0)
    return {
      label: `${exceeded} exceeded`,
      icon: "warning",
      color: "text-red-300",
    };
  if (cautionCount > 0)
    return {
      label: `${cautionCount} near limit`,
      icon: "info",
      color: "text-amber-300",
    };
  return { label: "All safe", icon: "check_circle", color: "text-emerald-300" };
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  safe: {
    bg: "bg-md-tertiary-fixed",
    text: "text-md-on-tertiary-fixed",
    label: "Safe",
  },
  caution: {
    bg: "bg-md-secondary-fixed",
    text: "text-md-on-secondary-fixed",
    label: "Caution",
  },
  exceed: {
    bg: "bg-md-error-container",
    text: "text-md-on-error-container",
    label: "Exceeded",
  },
};

const statusBarColor: Record<string, string> = {
  safe: "bg-md-tertiary",
  caution: "bg-md-secondary",
  exceed: "bg-md-error",
};

function NutrientCard({ item }: { item: NutrientProgress }) {
  const badge = statusBadge[item.status] ?? statusBadge.safe;
  const barColor = statusBarColor[item.status] ?? statusBarColor.safe;
  const pct = Math.min(item.percentage, 100);

  return (
    <div className="bg-md-surface-container-lowest p-6 rounded-3xl space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-semibold text-md-on-surface-variant">{item.displayName}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-md-on-surface">
              {formatAmount(item.consumed, item.unit)}
            </span>
            <span className="text-xs font-medium text-md-outline">
              / {formatAmount(item.dailyLimit, item.unit)}
            </span>
          </div>
        </div>
        <span
          className={`${badge.bg} ${badge.text} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}
        >
          {badge.label}
        </span>
      </div>
      <div className="h-3 w-full bg-md-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full liquid-track`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MealRow({ log }: { log: RecentLogEntry }) {
  const time = new Date(log.loggedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mealType = log.mealLabel ?? "Meal";

  return (
    <div className="flex items-center gap-4 bg-md-surface-container-low p-4 rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
        <span className="material-symbols-outlined text-md-primary">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-md-on-surface truncate">{log.foodName}</p>
        <p className="text-xs text-md-outline font-medium">
          {mealType} &middot; {time}
        </p>
      </div>
      <p className="font-bold text-md-on-surface text-sm shrink-0">
        {log.quantity}
        {log.servingLabel ? ` ${log.servingLabel}` : "g"}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const {
    nutrientProgress,
    recentLogs,
    displayName,
    healthGoal,
    streakDays,
    todayLogCount,
    error,
  } = await fetchDashboardData();

  const firstName = displayName?.split(/\s+/)[0] ?? null;
  const greeting = getTimeGreeting();
  const hasData = nutrientProgress.length > 0;
  const insight = getInsightMessage(nutrientProgress, todayLogCount);
  const overall = getOverallStatus(nutrientProgress);

  return (
    <div className="px-6 max-w-screen-xl mx-auto space-y-8">
      {error && (
        <p className="text-md-error text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Daily Hero Summary */}
      <section className="nutrient-glass rounded-[2.5rem] p-8 text-white shadow-[0_20px_40px_rgba(0,68,147,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative z-10">
          <p className="text-lg font-semibold mb-0.5">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </p>
          {healthGoal && <p className="text-blue-100/70 text-sm font-medium mb-4">{healthGoal}</p>}

          {/* Overall status + streak row */}
          <div className="flex items-center gap-6 mb-5">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-xl ${overall.color}`}>
                {overall.icon}
              </span>
              <span className={`text-sm font-bold ${overall.color}`}>{overall.label}</span>
            </div>
            {streakDays > 1 && (
              <div className="flex items-center gap-1.5 text-blue-100/70">
                <span className="material-symbols-outlined text-base">local_fire_department</span>
                <span className="text-sm font-semibold">{streakDays}-day streak</span>
              </div>
            )}
            {todayLogCount > 0 && (
              <span className="text-sm text-blue-100/60 font-medium">
                {todayLogCount} {todayLogCount === 1 ? "meal" : "meals"} logged
              </span>
            )}
          </div>

          {/* Personalized insight */}
          <p className="text-sm text-blue-100/80 mb-6 leading-relaxed max-w-md">{insight}</p>

          {/* Mini nutrient bars */}
          {hasData && (
            <div className="grid grid-cols-3 gap-4">
              {nutrientProgress.slice(0, 3).map((n) => (
                <div key={n.nutrientId} className="space-y-1">
                  <p className="text-[10px] text-blue-100/60 font-semibold uppercase">
                    {n.displayName}
                  </p>
                  <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full liquid-track"
                      style={{ width: `${Math.min(n.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold">
                    {formatAmount(n.consumed, n.unit)}
                    <span className="text-blue-100/40 font-medium">
                      {" "}
                      / {formatAmount(n.dailyLimit, n.unit)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Key Micronutrients */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-2xl font-bold tracking-tight text-md-on-surface">
            Key Micronutrients
          </h3>
          <Link href="/settings" className="text-sm font-semibold text-md-primary">
            See details
          </Link>
        </div>
        {nutrientProgress.length === 0 ? (
          <div className="bg-md-surface-container-lowest p-6 rounded-3xl">
            <p className="text-md-on-surface-variant text-sm">
              No nutrient limits configured.{" "}
              <Link href="/settings" className="text-md-primary font-semibold underline">
                Set up limits
              </Link>{" "}
              to start tracking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nutrientProgress.map((item) => (
              <NutrientCard key={item.nutrientId} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Meals */}
      <section className="pb-8">
        <h3 className="text-2xl font-bold tracking-tight text-md-on-surface mb-6">Recent Meals</h3>
        {recentLogs.length === 0 ? (
          <div className="bg-md-surface-container-low p-6 rounded-2xl text-center">
            <p className="text-md-on-surface-variant text-sm">
              No foods logged today.{" "}
              <Link href="/search" className="text-md-primary font-semibold underline">
                Search for a food
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <MealRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>

      {/* FABs */}
      <div className="fixed bottom-28 right-6 flex flex-col gap-3 items-end z-40">
        <Link
          href="/search"
          className="bg-md-surface-container-highest text-md-primary p-4 rounded-2xl shadow-lg flex items-center gap-2 font-bold active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">search</span>
          <span className="text-sm">Search food</span>
        </Link>
        <Link
          href="/search"
          className="bg-md-primary text-white p-5 rounded-[2rem] shadow-2xl flex items-center gap-3 font-bold active:scale-95 transition-all"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'wght' 600" }}
          >
            add
          </span>
          <span className="text-base">Add food</span>
        </Link>
      </div>
    </div>
  );
}
