"use client";

import { useState } from "react";

import type { AdminFoodDetail, NutrientOption } from "@/types";

import { FoodForm } from "@/components/admin/food-form";
import { NutrientValueEditor } from "@/components/admin/nutrient-value-editor";
import { VariantManager } from "@/components/admin/variant-manager";

interface FoodEditorProps {
  food: AdminFoodDetail;
  allNutrients: NutrientOption[];
}

export function FoodEditor({ food, allNutrients }: FoodEditorProps) {
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
          <NutrientValueEditor
            foodVariantId={selectedVariant.id}
            nutrients={selectedVariant.nutrients}
            allNutrients={allNutrients}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border p-8">
            <p className="text-muted-foreground text-sm">
              Select a variant to edit nutrient values
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
