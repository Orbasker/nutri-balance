"use client";

import { useState } from "react";

import type { AdminFoodDetail, SubstanceOption } from "@/types";

import { FoodForm } from "@/components/admin/food-form";
import { SubstanceValueEditor } from "@/components/admin/substance-value-editor";
import { VariantManager } from "@/components/admin/variant-manager";

interface FoodEditorProps {
  food: AdminFoodDetail;
  allSubstances: SubstanceOption[];
}

export function FoodEditor({ food, allSubstances }: FoodEditorProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    food.variants[0]?.id ?? null,
  );

  const selectedVariant = food.variants.find((v) => v.id === selectedVariantId);

  return (
    <div className="space-y-6">
      <FoodForm
        mode="edit"
        initialData={{
          foodId: food.id,
          name: food.name,
          category: food.category,
          description: food.description,
        }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <VariantManager
          foodId={food.id}
          variants={food.variants}
          onSelectVariant={setSelectedVariantId}
          selectedVariantId={selectedVariantId}
        />

        {selectedVariant ? (
          <SubstanceValueEditor
            foodVariantId={selectedVariant.id}
            substances={selectedVariant.substances}
            allSubstances={allSubstances}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border p-8">
            <p className="text-muted-foreground text-sm">
              Select a variant to edit substance values
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
