"use client";

import type { ServingMeasure } from "@/types";

import { cn } from "@/lib/utils";

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
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Amount */}
      <div className="bg-md-surface-container-lowest p-6 rounded-xl space-y-4">
        <label className="block text-xs font-bold text-md-outline uppercase tracking-wider">
          Amount
        </label>
        {isCustom ? (
          <input
            className="w-full bg-transparent border-0 border-b-2 border-md-outline-variant focus:border-md-primary focus:ring-0 text-3xl font-bold p-0 transition-colors outline-none"
            type="number"
            min={1}
            value={customGrams ?? ""}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) onCustomGramsChange(val);
            }}
          />
        ) : (
          <div className="flex items-center">
            <input
              className="w-full bg-transparent border-0 border-b-2 border-md-outline-variant focus:border-md-primary focus:ring-0 text-3xl font-bold p-0 transition-colors outline-none"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) onQuantityChange(val);
              }}
            />
          </div>
        )}
      </div>

      {/* Serving Unit */}
      <div className="bg-md-surface-container-lowest p-6 rounded-xl space-y-4">
        <label className="block text-xs font-bold text-md-outline uppercase tracking-wider">
          Serving Unit
        </label>
        <div className="flex flex-wrap gap-2">
          {servingMeasures.map((measure) => (
            <button
              key={measure.id}
              onClick={() => onMeasureChange(measure.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                selectedMeasureId === measure.id && !isCustom
                  ? "bg-md-primary text-white"
                  : "bg-md-surface-container-high text-md-on-surface-variant hover:bg-md-surface-container-highest",
              )}
            >
              {measure.label} ({measure.gramsEquivalent}g)
            </button>
          ))}
          <button
            onClick={() => onCustomGramsChange(customGrams ?? 100)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              isCustom
                ? "bg-md-primary text-white"
                : "bg-md-surface-container-high text-md-on-surface-variant hover:bg-md-surface-container-highest",
            )}
          >
            Custom (g)
          </button>
        </div>
        <p className="text-md-on-surface-variant text-sm mt-2">
          Total: <span className="font-bold text-md-on-surface">{totalGrams.toFixed(0)}g</span>
        </p>
      </div>
    </section>
  );
}
