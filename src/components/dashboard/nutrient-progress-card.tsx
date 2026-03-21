"use client";

import type { NutrientProgress } from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
} from "@/components/ui/progress";

import { cn } from "@/lib/utils";

const statusColors: Record<NutrientProgress["status"], string> = {
  safe: "bg-[#00531c] dark:bg-[#68f47f]",
  caution: "bg-[#4c4aca] dark:bg-[#c2c1ff]",
  exceed: "bg-[#ba1a1a] dark:bg-[#ffb4ab]",
};

const statusTrackColors: Record<NutrientProgress["status"], string> = {
  safe: "bg-[#e9e7ed] dark:bg-[#2f3034]",
  caution: "bg-[#e9e7ed] dark:bg-[#2f3034]",
  exceed: "bg-[#ffdad6] dark:bg-[#93000a]",
};

function formatAmount(value: number, unit: string): string {
  if (unit === "mcg" || value >= 100) return `${Math.round(value)}${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

interface NutrientProgressCardProps {
  items: NutrientProgress[];
}

export function NutrientProgressCard({ items }: NutrientProgressCardProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nutrient Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No nutrient limits configured.{" "}
            <a href="/settings" className="text-primary underline underline-offset-4">
              Set up limits
            </a>{" "}
            to start tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrient Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item) => (
          <Progress key={item.nutrientId} value={Math.min(item.percentage, 100)}>
            <ProgressLabel>{item.displayName}</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {formatAmount(item.consumed, item.unit)} / {formatAmount(item.dailyLimit, item.unit)}
            </span>
            <ProgressTrack className={cn("h-2", statusTrackColors[item.status])}>
              <ProgressIndicator className={cn(statusColors[item.status])} />
            </ProgressTrack>
            <span className="text-muted-foreground text-xs">
              {formatAmount(item.remaining, item.unit)} remaining
            </span>
          </Progress>
        ))}
      </CardContent>
    </Card>
  );
}
