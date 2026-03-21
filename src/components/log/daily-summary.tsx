import type { DailyNutrientTotal } from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { cn } from "@/lib/utils";

const statusColors = {
  safe: "text-green-700 dark:text-green-400",
  caution: "text-yellow-700 dark:text-yellow-400",
  exceed: "text-red-700 dark:text-red-400",
} as const;

const progressColors = {
  safe: "[&>div]:bg-green-500",
  caution: "[&>div]:bg-yellow-500",
  exceed: "[&>div]:bg-red-500",
} as const;

interface DailySummaryProps {
  totals: DailyNutrientTotal[];
  dateLabel: string;
}

export function DailySummary({ totals, dateLabel }: DailySummaryProps) {
  if (totals.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-sm">
            No nutrient limits configured.{" "}
            <a href="/settings" className="underline">
              Set up limits
            </a>{" "}
            to see your daily summary.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Daily Summary</CardTitle>
        <p className="text-muted-foreground text-xs">{dateLabel}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {totals.map((nutrient) => {
          const pct =
            nutrient.dailyLimit && nutrient.dailyLimit > 0
              ? Math.min((nutrient.total / nutrient.dailyLimit) * 100, 100)
              : 0;

          return (
            <div key={nutrient.nutrientId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{nutrient.displayName}</span>
                <span className={cn("text-xs font-medium", statusColors[nutrient.status])}>
                  {nutrient.status === "safe" && "Safe"}
                  {nutrient.status === "caution" && "Caution"}
                  {nutrient.status === "exceed" && "Exceeds limit"}
                </span>
              </div>
              <Progress value={pct} className={cn("h-2", progressColors[nutrient.status])} />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  {nutrient.total.toFixed(1)} {nutrient.unit}
                </span>
                <span>
                  Limit: {nutrient.dailyLimit?.toFixed(1)} {nutrient.unit}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
