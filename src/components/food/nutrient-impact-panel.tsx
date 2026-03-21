"use client";

import type { NutrientImpact } from "@/types";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import { cn } from "@/lib/utils";

interface NutrientImpactPanelProps {
  impacts: NutrientImpact[];
  portionGrams: number;
  mealLabel: string;
  onMealLabelChange: (label: string) => void;
  onAddToToday: () => void;
  pending: boolean;
  error: string | null;
  success: boolean;
}

const statusColors = {
  safe: "text-[#00531c] dark:text-[#68f47f]",
  caution: "text-[#4c4aca] dark:text-[#c2c1ff]",
  exceed: "text-[#ba1a1a] dark:text-[#ffb4ab]",
} as const;

const progressColors = {
  safe: "[&>div]:bg-[#00531c] dark:[&>div]:bg-[#68f47f]",
  caution: "[&>div]:bg-[#4c4aca] dark:[&>div]:bg-[#c2c1ff]",
  exceed: "[&>div]:bg-[#ba1a1a] dark:[&>div]:bg-[#ffb4ab]",
} as const;

export function NutrientImpactPanel({
  impacts,
  portionGrams,
  mealLabel,
  onMealLabelChange,
  onAddToToday,
  pending,
  error,
  success,
}: NutrientImpactPanelProps) {
  const trackedImpacts = impacts.filter((i) => i.dailyLimit !== null);
  const untrackedImpacts = impacts.filter((i) => i.dailyLimit === null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">If you eat this</CardTitle>
        <p className="text-muted-foreground text-xs">
          Impact on your daily limits ({portionGrams.toFixed(0)}g serving)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {trackedImpacts.length > 0 ? (
          <div className="space-y-3">
            {trackedImpacts.map((impact) => {
              const pct =
                impact.dailyLimit && impact.dailyLimit > 0
                  ? Math.min((impact.newTotal / impact.dailyLimit) * 100, 100)
                  : 0;

              return (
                <div key={impact.nutrientId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{impact.displayName}</span>
                    <span className={cn("text-xs font-medium", statusColors[impact.status])}>
                      {impact.status === "safe" && "Safe"}
                      {impact.status === "caution" && "Caution"}
                      {impact.status === "exceed" && "Exceeds limit"}
                    </span>
                  </div>
                  <Progress value={pct} className={cn("h-2", progressColors[impact.status])} />
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>
                      {impact.consumedToday.toFixed(1)} + {impact.addedAmount.toFixed(1)} ={" "}
                      <span className="font-medium text-foreground">
                        {impact.newTotal.toFixed(1)} {impact.unit}
                      </span>
                    </span>
                    <span>
                      Limit: {impact.dailyLimit?.toFixed(1)} {impact.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No nutrient limits configured.{" "}
            <a href="/settings" className="underline">
              Set up limits
            </a>{" "}
            to see the impact.
          </p>
        )}

        {untrackedImpacts.length > 0 && trackedImpacts.length > 0 && (
          <div className="text-muted-foreground text-xs">
            + {untrackedImpacts.length} untracked nutrient
            {untrackedImpacts.length > 1 ? "s" : ""}
          </div>
        )}

        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">Meal:</span>
            <Input
              type="text"
              placeholder="e.g. Breakfast, Lunch, Snack"
              value={mealLabel}
              onChange={(e) => onMealLabelChange(e.target.value)}
              className="h-8 flex-1 text-sm"
            />
          </div>

          <Button onClick={onAddToToday} disabled={pending || success} className="w-full">
            {pending ? (
              "Adding..."
            ) : success ? (
              <>
                <Check className="mr-1 h-4 w-4" /> Added to today
              </>
            ) : (
              "Add to today"
            )}
          </Button>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
