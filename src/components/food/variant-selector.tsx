"use client";

import type { FoodVariantDetail } from "@/types";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VariantSelectorProps {
  variants: FoodVariantDetail[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
}

export function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  if (variants.length <= 1) return null;

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">Preparation method</h2>
      <Tabs value={selectedVariantId} onValueChange={onSelect}>
        <TabsList>
          {variants.map((v) => (
            <TabsTrigger key={v.id} value={v.id} className="capitalize">
              {v.preparationMethod}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
