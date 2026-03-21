"use client";

import { useState } from "react";

import type { NutrientDetail } from "@/types";
import { ChevronDown, ChevronUp } from "lucide-react";

import { ConfidenceBadge } from "@/components/food/confidence-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { calculateNutrientAmount } from "@/lib/calculations";

interface NutrientBreakdownProps {
  nutrients: NutrientDetail[];
  portionGrams: number;
}

export function NutrientBreakdown({ nutrients, portionGrams }: NutrientBreakdownProps) {
  const [showSources, setShowSources] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Nutrient breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-muted-foreground grid grid-cols-4 gap-2 border-b pb-1 text-xs font-medium">
            <span>Nutrient</span>
            <span className="text-right">Per 100g</span>
            <span className="text-right">This serving</span>
            <span className="text-right">Confidence</span>
          </div>
          {nutrients.map((n) => {
            const amount = calculateNutrientAmount(n.valuePer100g, portionGrams);
            return (
              <div key={n.nutrientId} className="grid grid-cols-4 gap-2 py-1.5 text-sm">
                <span className="font-medium">{n.displayName}</span>
                <span className="text-muted-foreground text-right">
                  {n.valuePer100g.toFixed(1)} {n.unit}
                </span>
                <span className="text-right font-medium">
                  {amount.toFixed(1)} {n.unit}
                </span>
                <span className="flex justify-end">
                  <ConfidenceBadge level={n.confidenceLabel} />
                </span>
              </div>
            );
          })}
        </div>

        {nutrients.some((n) => n.sourceSummary) && (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSources(!showSources)}
              className="text-muted-foreground h-auto p-0 text-xs"
            >
              {showSources ? (
                <>
                  Hide sources <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  Show sources <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
            {showSources && (
              <div className="mt-2 space-y-1">
                {nutrients
                  .filter((n) => n.sourceSummary)
                  .map((n) => (
                    <p key={n.nutrientId} className="text-muted-foreground text-xs">
                      <span className="font-medium">{n.displayName}:</span> {n.sourceSummary}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
