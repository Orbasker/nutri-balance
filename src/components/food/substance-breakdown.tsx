"use client";

import { useMemo, useState } from "react";

import type { ConfidenceLabel, SubstanceCategory, SubstanceDetail } from "@/types";

import { calculateSubstanceAmount } from "@/lib/calculations";

interface SubstanceBreakdownProps {
  substances: SubstanceDetail[];
  portionGrams: number;
  totalSubstanceCount?: number;
  onEnrichRequest?: () => void;
  enrichPending?: boolean;
}

const CATEGORY_ORDER: SubstanceCategory[] = [
  "macronutrient",
  "lipid",
  "vitamin",
  "mineral",
  "other",
];

const CATEGORY_LABELS: Record<SubstanceCategory, string> = {
  macronutrient: "Macronutrients",
  lipid: "Fats & Fatty Acids",
  vitamin: "Vitamins",
  mineral: "Minerals",
  other: "Other",
};

const CATEGORY_ICONS: Record<SubstanceCategory, string> = {
  macronutrient: "local_fire_department",
  lipid: "water_drop",
  vitamin: "wb_sunny",
  mineral: "diamond",
  other: "more_horiz",
};

// Macro hero substances to feature prominently
const MACRO_HERO_NAMES = ["energy", "protein", "total_fat", "carbohydrates"];

export function SubstanceBreakdown({
  substances,
  portionGrams,
  totalSubstanceCount,
  onEnrichRequest,
  enrichPending,
}: SubstanceBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<SubstanceCategory>>(
    new Set(CATEGORY_ORDER),
  );

  // Separate hero macros from grouped list
  const heroMacros = useMemo(
    () => substances.filter((s) => MACRO_HERO_NAMES.includes(s.name)),
    [substances],
  );

  // Group remaining substances by category
  const grouped = useMemo(() => {
    const map = new Map<SubstanceCategory, SubstanceDetail[]>();
    for (const s of substances) {
      if (MACRO_HERO_NAMES.includes(s.name)) continue;
      const cat = s.category ?? "other";
      const list = map.get(cat) ?? [];
      list.push(s);
      map.set(cat, list);
    }
    return map;
  }, [substances]);

  const toggleCategory = (cat: SubstanceCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const missingCount =
    totalSubstanceCount != null ? Math.max(0, totalSubstanceCount - substances.length) : null;

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold">Nutritional Profile</h3>
        <span className="text-md-outline font-medium text-sm">per serving</span>
      </div>

      {/* Hero Macros Grid */}
      {heroMacros.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {heroMacros.map((s) => {
            const amount = calculateSubstanceAmount(s.valuePer100g, portionGrams);
            const isCalories = s.name === "energy";
            return (
              <div
                key={s.substanceId}
                className={`p-5 rounded-2xl ${
                  isCalories
                    ? "col-span-2 bg-md-primary-container/10"
                    : "bg-md-surface-container-lowest"
                }`}
              >
                <span
                  className={`font-bold block ${
                    isCalories ? "text-3xl text-md-primary" : "text-xl text-md-on-surface"
                  }`}
                >
                  {isCalories ? Math.round(amount) : amount.toFixed(1)}
                  {!isCalories && (
                    <span className="text-sm font-medium text-md-on-surface-variant ml-0.5">
                      {s.unit}
                    </span>
                  )}
                </span>
                <span
                  className={`font-semibold text-xs uppercase tracking-wider ${
                    isCalories ? "text-md-primary/70" : "text-md-outline"
                  }`}
                >
                  {s.displayName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Categorized Substance Lists */}
      <div className="space-y-3">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;

          const isExpanded = expandedCategories.has(cat);

          return (
            <div key={cat} className="bg-md-surface-container-low rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-md-surface-container transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-md-primary text-xl">
                    {CATEGORY_ICONS[cat]}
                  </span>
                  <span className="font-bold text-sm text-md-on-surface">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-xs text-md-outline bg-md-surface-container-high px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-md-outline text-lg transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-4">
                  {items.map((s) => {
                    const amount = calculateSubstanceAmount(s.valuePer100g, portionGrams);
                    return (
                      <div key={s.substanceId} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-md-on-surface">
                            {s.displayName}
                          </span>
                          <span className="text-md-on-surface-variant text-sm font-medium tabular-nums">
                            {amount < 0.1 && amount > 0
                              ? `<0.1 ${s.unit}`
                              : `${amount.toFixed(1)} ${s.unit}`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-md-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-md-primary/70 rounded-full"
                            style={{
                              width: `${Math.min(50, Math.max(2, (amount / (s.valuePer100g * 2 || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                        {s.sourceSummary && (
                          <SourceTag summary={s.sourceSummary} confidence={s.confidenceLabel} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Missing Data / Enrich with AI */}
      {missingCount != null && missingCount > 0 && onEnrichRequest && (
        <div className="bg-md-tertiary-container/10 border border-md-tertiary/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-md-tertiary text-xl mt-0.5">
              auto_awesome
            </span>
            <div className="space-y-1">
              <p className="text-sm font-bold text-md-on-surface">
                {missingCount} more nutrient{missingCount === 1 ? "" : "s"} available
              </p>
              <p className="text-xs text-md-on-surface-variant">
                Use AI to research and fill in missing nutritional data from USDA and scientific
                sources.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onEnrichRequest}
            disabled={enrichPending}
            className="w-full bg-md-tertiary text-md-on-tertiary px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            {enrichPending ? "Researching..." : "Enrich with AI"}
          </button>
        </div>
      )}
    </section>
  );
}

const SOURCE_ICONS: Record<string, string> = {
  usda: "verified",
  "government database": "verified",
  "scientific literature": "science",
  "ai-researched": "auto_awesome",
  "ai-researched (pending review)": "auto_awesome",
  manual: "edit_note",
};

function getSourceIcon(summary: string): string {
  const lower = summary.toLowerCase();
  for (const [key, icon] of Object.entries(SOURCE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "database";
}

function SourceTag({ summary, confidence }: { summary: string; confidence: ConfidenceLabel }) {
  const icon = getSourceIcon(summary);
  const isPending = summary.toLowerCase().includes("pending review");

  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] leading-tight ${
        isPending ? "text-md-tertiary" : "text-md-outline"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      <span className="truncate">{summary}</span>
      {confidence === "low" && (
        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
          Low confidence
        </span>
      )}
    </div>
  );
}
