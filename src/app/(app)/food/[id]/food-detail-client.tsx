"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import type { FoodDetail, FoodVariantDetail, NutrientImpact } from "@/types";

import { NutrientBreakdown } from "@/components/food/nutrient-breakdown";
import { NutrientImpactPanel } from "@/components/food/nutrient-impact-panel";
import { ServingSelector } from "@/components/food/serving-selector";
import { VariantSelector } from "@/components/food/variant-selector";

import { calculateNutrientAmount, getNutrientStatus } from "@/lib/calculations";

import { addToToday } from "./actions";

interface FoodDetailClientProps {
  food: FoodDetail;
  todaysConsumption: Record<string, number>;
  userLimits: Array<{
    nutrientId: string;
    dailyLimit: number;
    mode: "strict" | "stability";
    rangeMin: number | null;
    rangeMax: number | null;
  }>;
}

export function FoodDetailClient({ food, todaysConsumption, userLimits }: FoodDetailClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultVariant = food.variants.find((v) => v.isDefault) ?? food.variants[0];
  const [selectedVariant, setSelectedVariant] = useState<FoodVariantDetail>(defaultVariant);
  const [servingMeasureId, setServingMeasureId] = useState<string | null>(
    selectedVariant?.servingMeasures[0]?.id ?? null,
  );
  const [customGrams, setCustomGrams] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mealLabel, setMealLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const portionGrams = useMemo(() => {
    if (customGrams !== null) return customGrams * quantity;
    const measure = selectedVariant?.servingMeasures.find((s) => s.id === servingMeasureId);
    return (measure?.gramsEquivalent ?? 100) * quantity;
  }, [customGrams, quantity, selectedVariant, servingMeasureId]);

  const impacts: NutrientImpact[] = useMemo(() => {
    if (!selectedVariant) return [];
    const limitsMap = new Map(userLimits.map((l) => [l.nutrientId, l]));

    return selectedVariant.nutrients.map((n) => {
      const addedAmount = calculateNutrientAmount(n.valuePer100g, portionGrams);
      const consumedToday = todaysConsumption[n.nutrientId] ?? 0;
      const newTotal = consumedToday + addedAmount;
      const limit = limitsMap.get(n.nutrientId);

      return {
        nutrientId: n.nutrientId,
        displayName: n.displayName,
        unit: n.unit,
        consumedToday,
        addedAmount,
        newTotal,
        dailyLimit: limit?.dailyLimit ?? null,
        mode: limit?.mode ?? null,
        rangeMin: limit?.rangeMin ?? null,
        rangeMax: limit?.rangeMax ?? null,
        status: getNutrientStatus(newTotal, limit?.dailyLimit ?? null),
      };
    });
  }, [selectedVariant, portionGrams, todaysConsumption, userLimits]);

  const nutrientSnapshot = useMemo(() => {
    const snap: Record<string, number> = {};
    for (const impact of impacts) {
      snap[impact.nutrientId] = impact.addedAmount;
    }
    return snap;
  }, [impacts]);

  const handleVariantChange = useCallback(
    (variantId: string) => {
      const variant = food.variants.find((v) => v.id === variantId);
      if (variant) {
        setSelectedVariant(variant);
        setServingMeasureId(variant.servingMeasures[0]?.id ?? null);
        setCustomGrams(null);
        setSuccess(false);
      }
    },
    [food.variants],
  );

  const handleAddToToday = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await addToToday({
        foodVariantId: selectedVariant.id,
        servingMeasureId: customGrams !== null ? null : servingMeasureId,
        quantity: portionGrams,
        gramsAmount: portionGrams,
        nutrientSnapshot,
        mealLabel: mealLabel || undefined,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  };

  if (!selectedVariant) {
    return <p className="text-muted-foreground">No variants available for this food.</p>;
  }

  return (
    <div className="space-y-6">
      <VariantSelector
        variants={food.variants}
        selectedVariantId={selectedVariant.id}
        onSelect={handleVariantChange}
      />

      <ServingSelector
        servingMeasures={selectedVariant.servingMeasures}
        selectedMeasureId={servingMeasureId}
        customGrams={customGrams}
        quantity={quantity}
        onMeasureChange={(id) => {
          setServingMeasureId(id);
          setCustomGrams(null);
          setSuccess(false);
        }}
        onCustomGramsChange={(g) => {
          setCustomGrams(g);
          setServingMeasureId(null);
          setSuccess(false);
        }}
        onQuantityChange={(q) => {
          setQuantity(q);
          setSuccess(false);
        }}
      />

      <NutrientBreakdown nutrients={selectedVariant.nutrients} portionGrams={portionGrams} />

      <NutrientImpactPanel
        impacts={impacts}
        portionGrams={portionGrams}
        mealLabel={mealLabel}
        onMealLabelChange={setMealLabel}
        onAddToToday={handleAddToToday}
        pending={pending}
        error={error}
        success={success}
      />
    </div>
  );
}
