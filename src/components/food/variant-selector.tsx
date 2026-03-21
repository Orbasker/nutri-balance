"use client";

import type { FoodVariantDetail } from "@/types";

import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  variants: FoodVariantDetail[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
}

export function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  if (variants.length <= 1) return null;

  return (
    <div className="space-y-4">
      <label className="text-sm font-semibold text-md-outline tracking-wide uppercase">
        Cooking Method
      </label>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={cn(
              "px-5 py-2.5 rounded-full font-semibold text-sm transition-all capitalize",
              v.id === selectedVariantId
                ? "bg-md-primary-container text-md-on-primary-container"
                : "bg-md-surface-container-high text-md-on-surface-variant hover:bg-md-surface-container-highest",
            )}
          >
            {v.preparationMethod}
          </button>
        ))}
      </div>
    </div>
  );
}
