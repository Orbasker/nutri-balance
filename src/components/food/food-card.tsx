import Link from "next/link";

import type { FoodSearchResult } from "@/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ConfidenceBadge } from "./confidence-badge";

interface FoodCardProps {
  food: FoodSearchResult;
}

export function FoodCard({ food }: FoodCardProps) {
  const defaultVariant = food.variants.find((v) => v.isDefault) ?? food.variants[0];

  return (
    <Link href={`/food/${food.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{food.name}</CardTitle>
          {food.category && (
            <p className="text-xs text-muted-foreground capitalize">{food.category}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {food.variants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {food.variants.map((variant) => (
                <Badge
                  key={variant.id}
                  variant={variant.id === defaultVariant?.id ? "default" : "secondary"}
                >
                  {variant.preparationMethod}
                </Badge>
              ))}
            </div>
          )}

          {defaultVariant?.topNutrient && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {defaultVariant.topNutrient.displayName}:{" "}
                <span className="font-medium text-foreground">
                  {defaultVariant.topNutrient.valuePer100g.toFixed(1)}{" "}
                  {defaultVariant.topNutrient.unit}
                </span>
              </span>
              <ConfidenceBadge level={defaultVariant.topNutrient.confidenceLabel} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
