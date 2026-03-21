"use client";

import type { NutrientDetail } from "@/types";

import { calculateNutrientAmount } from "@/lib/calculations";

interface NutrientBreakdownProps {
  nutrients: NutrientDetail[];
  portionGrams: number;
}

export function NutrientBreakdown({ nutrients, portionGrams }: NutrientBreakdownProps) {
  // Calculate calories (first nutrient or find one with 'calorie' in name)
  const calorieNutrient = nutrients.find(
    (n) => n.name.toLowerCase().includes("calorie") || n.name.toLowerCase().includes("energy"),
  );
  const calories = calorieNutrient
    ? calculateNutrientAmount(calorieNutrient.valuePer100g, portionGrams)
    : null;

  const proteinNutrient = nutrients.find((n) => n.name.toLowerCase().includes("protein"));
  const carbNutrient = nutrients.find(
    (n) => n.name.toLowerCase().includes("carb") || n.name.toLowerCase().includes("carbohydrate"),
  );

  return (
    <section className="space-y-8">
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold">Nutritional Profile</h3>
        <span className="text-md-outline font-medium text-sm">per serving</span>
      </div>

      {/* Macro Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {calories !== null && (
          <div className="col-span-2 md:col-span-1 bg-md-primary-container/10 p-6 rounded-2xl">
            <span className="text-md-primary font-bold text-3xl block">{Math.round(calories)}</span>
            <span className="text-md-primary/70 font-semibold text-sm uppercase tracking-wider">
              Calories
            </span>
          </div>
        )}
        {proteinNutrient && (
          <div className="bg-md-surface-container-lowest p-6 rounded-2xl space-y-2">
            <span className="text-md-on-surface font-bold text-xl block">
              {calculateNutrientAmount(proteinNutrient.valuePer100g, portionGrams).toFixed(1)}g
            </span>
            <span className="text-md-outline font-medium text-xs uppercase tracking-wider">
              Protein
            </span>
          </div>
        )}
        {carbNutrient && (
          <div className="bg-md-surface-container-lowest p-6 rounded-2xl space-y-2">
            <span className="text-md-on-surface font-bold text-xl block">
              {calculateNutrientAmount(carbNutrient.valuePer100g, portionGrams).toFixed(1)}g
            </span>
            <span className="text-md-outline font-medium text-xs uppercase tracking-wider">
              Carbs
            </span>
          </div>
        )}
      </div>

      {/* Nutrient Impact Bars */}
      <div className="bg-md-surface-container-low p-8 rounded-3xl space-y-6">
        {nutrients.map((n) => {
          const amount = calculateNutrientAmount(n.valuePer100g, portionGrams);
          // Use a rough scale where 100% of bar = 2x the per-100g value
          const barPct = Math.min((n.valuePer100g / (n.valuePer100g * 2 || 100)) * 100, 100);

          return (
            <div key={n.nutrientId} className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-md-on-surface">{n.displayName}</span>
                <span className="text-md-on-surface-variant text-sm font-medium">
                  {amount.toFixed(1)} {n.unit}
                </span>
              </div>
              <div className="h-2 w-full bg-md-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-md-primary rounded-full liquid-track"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
