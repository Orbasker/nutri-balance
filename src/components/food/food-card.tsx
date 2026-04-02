import Link from "next/link";

import type { FoodSearchResult } from "@/types";

const tagColors: Record<string, string> = {
  high: "bg-md-tertiary-fixed text-md-on-tertiary-fixed-variant",
  good: "bg-md-secondary-fixed text-md-on-secondary-fixed-variant",
  moderate: "bg-md-primary-fixed text-md-on-primary-fixed-variant",
  low: "bg-md-surface-container-high text-md-on-surface-variant",
};

const densityBarColors: Record<string, string> = {
  high: "bg-md-primary",
  good: "bg-md-secondary",
  moderate: "bg-md-primary",
  low: "bg-md-outline",
};

interface FoodCardProps {
  food: FoodSearchResult;
}

export function FoodCard({ food }: FoodCardProps) {
  const defaultVariant = food.variants.find((v) => v.isDefault) ?? food.variants[0];
  const topSubstance = defaultVariant?.topSubstance;

  const confidenceLevel = topSubstance?.confidenceLabel ?? "moderate";
  const tagColor = tagColors[confidenceLevel] ?? tagColors.moderate;
  const barColor = densityBarColors[confidenceLevel] ?? densityBarColors.moderate;

  const densityPct = topSubstance ? Math.min(topSubstance.confidenceScore, 100) : 50;

  return (
    <Link href={`/food/${food.id}`}>
      <div className="bg-md-surface-container-lowest p-5 rounded-3xl shadow-[0_10px_30px_rgba(0,68,147,0.04)] hover:scale-[0.98] transition-all duration-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            {food.category && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-md-outline-variant block mb-1">
                {food.category}
              </span>
            )}
            <h4 className="text-xl font-bold text-md-on-surface">{food.name}</h4>
          </div>
          {topSubstance && (
            <div className={`${tagColor} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>
              {topSubstance.displayName}
            </div>
          )}
        </div>

        {food.isAiGenerated && (
          <div className="flex items-center gap-1.5 bg-md-tertiary-fixed/30 border border-md-tertiary/20 rounded-lg px-3 py-1.5 mb-3">
            <span className="material-symbols-outlined text-md-tertiary text-[16px]">
              neurology
            </span>
            <span className="text-[11px] font-bold text-md-on-surface-variant uppercase tracking-wide">
              AI Generated &middot; Pending Review
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          {defaultVariant && (
            <>
              <div className="flex items-center gap-1.5 text-md-on-surface-variant">
                <span className="material-symbols-outlined text-sm">restaurant_menu</span>
                <span className="text-sm font-medium capitalize">
                  {defaultVariant.preparationMethod}
                </span>
              </div>
              {topSubstance && (
                <>
                  <div className="w-1 h-1 rounded-full bg-md-outline-variant" />
                  <div className="text-sm font-medium text-md-on-surface-variant">
                    {topSubstance.valuePer100g.toFixed(0)} {topSubstance.unit} / 100g
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] font-bold text-md-outline uppercase tracking-tighter">
            <span>Substance Density</span>
            <span className="text-md-primary">{densityPct}%</span>
          </div>
          <div className="h-2 w-full bg-md-surface-container-high rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full liquid-track`}
              style={{ width: `${densityPct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
