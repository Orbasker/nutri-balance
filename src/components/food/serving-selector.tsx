"use client";

import type { ServingMeasure } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ServingSelectorProps {
  servingMeasures: ServingMeasure[];
  selectedMeasureId: string | null;
  customGrams: number | null;
  quantity: number;
  onMeasureChange: (id: string) => void;
  onCustomGramsChange: (grams: number | null) => void;
  onQuantityChange: (quantity: number) => void;
}

export function ServingSelector({
  servingMeasures,
  selectedMeasureId,
  customGrams,
  quantity,
  onMeasureChange,
  onCustomGramsChange,
  onQuantityChange,
}: ServingSelectorProps) {
  const isCustom = customGrams !== null;
  const selectedMeasure = servingMeasures.find((s) => s.id === selectedMeasureId);

  const totalGrams = isCustom
    ? (customGrams ?? 0) * quantity
    : (selectedMeasure?.gramsEquivalent ?? 100) * quantity;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Serving size</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {servingMeasures.map((measure) => (
            <Button
              key={measure.id}
              variant={selectedMeasureId === measure.id && !isCustom ? "default" : "outline"}
              size="sm"
              onClick={() => onMeasureChange(measure.id)}
            >
              {measure.label}
              <span className="text-muted-foreground ml-1 text-xs">
                ({measure.gramsEquivalent}g)
              </span>
            </Button>
          ))}
          <Button
            variant={isCustom ? "default" : "outline"}
            size="sm"
            onClick={() => onCustomGramsChange(customGrams ?? 100)}
          >
            Custom
          </Button>
        </div>

        {isCustom && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={customGrams ?? ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) onCustomGramsChange(val);
              }}
              className="w-24"
              placeholder="grams"
            />
            <span className="text-muted-foreground text-sm">grams</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm">Quantity:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            -
          </Button>
          <span className="w-8 text-center text-sm font-medium">{quantity}</span>
          <Button variant="outline" size="sm" onClick={() => onQuantityChange(quantity + 1)}>
            +
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Total: <span className="font-medium text-foreground">{totalGrams.toFixed(0)}g</span>
        </p>
      </CardContent>
    </Card>
  );
}
