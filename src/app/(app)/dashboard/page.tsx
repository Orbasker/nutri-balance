import { NutrientProgressCard } from "@/components/dashboard/nutrient-progress-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentFoodsCard } from "@/components/dashboard/recent-foods-card";

import { fetchDashboardData } from "./actions";

export default async function DashboardPage() {
  const { nutrientProgress, recentLogs, error } = await fetchDashboardData();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your daily nutrient tracking overview.</p>
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <QuickActions />
      <NutrientProgressCard items={nutrientProgress} />
      <RecentFoodsCard logs={recentLogs} />
    </div>
  );
}
