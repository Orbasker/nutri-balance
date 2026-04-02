"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import type { FoodDetail, FoodVariantDetail, SubstanceImpact } from "@/types";

import { ConfidenceBadge } from "@/components/food/confidence-badge";
import { ServingSelector } from "@/components/food/serving-selector";
import { SubstanceBreakdown } from "@/components/food/substance-breakdown";
import { SubstanceImpactPanel } from "@/components/food/substance-impact-panel";
import { VariantSelector } from "@/components/food/variant-selector";

import { calculateSubstanceAmount, getSubstanceStatus } from "@/lib/calculations";

import { addToToday } from "./actions";

interface FoodDetailClientProps {
  food: FoodDetail;
  todaysConsumption: Record<string, number>;
  userLimits: Array<{
    substanceId: string;
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

  const impacts: SubstanceImpact[] = useMemo(() => {
    if (!selectedVariant) return [];
    const limitsMap = new Map(userLimits.map((l) => [l.substanceId, l]));

    return selectedVariant.substances.map((n) => {
      const addedAmount = calculateSubstanceAmount(n.valuePer100g, portionGrams);
      const consumedToday = todaysConsumption[n.substanceId] ?? 0;
      const newTotal = consumedToday + addedAmount;
      const limit = limitsMap.get(n.substanceId);

      return {
        substanceId: n.substanceId,
        displayName: n.displayName,
        unit: n.unit,
        consumedToday,
        addedAmount,
        newTotal,
        dailyLimit: limit?.dailyLimit ?? null,
        mode: limit?.mode ?? null,
        rangeMin: limit?.rangeMin ?? null,
        rangeMax: limit?.rangeMax ?? null,
        status: getSubstanceStatus(newTotal, limit?.dailyLimit ?? null),
      };
    });
  }, [selectedVariant, portionGrams, todaysConsumption, userLimits]);

  const substanceSnapshot = useMemo(() => {
    const snap: Record<string, number> = {};
    for (const impact of impacts) {
      snap[impact.substanceId] = impact.addedAmount;
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
        substanceSnapshot,
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
    return <p className="text-md-on-surface-variant">No variants available for this food.</p>;
  }

  // Get average confidence from substances
  const avgConfidence =
    selectedVariant.substances.length > 0
      ? selectedVariant.substances.reduce((s, n) => s + n.confidenceScore, 0) /
        selectedVariant.substances.length
      : 0;
  const confidenceLabel =
    avgConfidence >= 90
      ? "high"
      : avgConfidence >= 80
        ? "good"
        : avgConfidence >= 60
          ? "moderate"
          : "low";

  return (
    <div className="space-y-8">
      {/* Confidence Indicator */}
      <ConfidenceBadge level={confidenceLabel} score={avgConfidence} />

      {/* Variant Selector (Cooking Method Chips) */}
      <VariantSelector
        variants={food.variants}
        selectedVariantId={selectedVariant.id}
        onSelect={handleVariantChange}
      />

      {/* Serving Selector */}
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

      {/* Substance Breakdown */}
      <SubstanceBreakdown substances={selectedVariant.substances} portionGrams={portionGrams} />

      {/* Impact Panel */}
      <SubstanceImpactPanel
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
