import type { FoodSearchResult, FoodVariantSummary } from "@/types";
import { describe, expect, it } from "vitest";

import { getConfidenceLabel } from "@/lib/calculations";

describe("FoodSearchResult type", () => {
  it("can be constructed with required fields", () => {
    const variant: FoodVariantSummary = {
      id: "variant-1",
      preparationMethod: "raw",
      isDefault: true,
      topNutrient: {
        name: "Vitamin K",
        displayName: "Vitamin K",
        valuePer100g: 482.9,
        unit: "mcg",
        confidenceScore: 95,
        confidenceLabel: "high",
      },
    };

    const result: FoodSearchResult = {
      id: "food-1",
      name: "Spinach",
      category: "vegetables",
      variants: [variant],
    };

    expect(result.id).toBe("food-1");
    expect(result.name).toBe("Spinach");
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].topNutrient?.confidenceLabel).toBe("high");
  });

  it("supports food with no variants", () => {
    const result: FoodSearchResult = {
      id: "food-2",
      name: "Mystery Food",
      category: null,
      variants: [],
    };

    expect(result.variants).toHaveLength(0);
  });

  it("supports variant with no top nutrient", () => {
    const variant: FoodVariantSummary = {
      id: "variant-2",
      preparationMethod: "boiled",
      isDefault: false,
      topNutrient: null,
    };

    expect(variant.topNutrient).toBeNull();
  });
});

describe("getConfidenceLabel", () => {
  it("returns 'high' for scores 90-100", () => {
    expect(getConfidenceLabel(90)).toBe("high");
    expect(getConfidenceLabel(95)).toBe("high");
    expect(getConfidenceLabel(100)).toBe("high");
  });

  it("returns 'good' for scores 80-89", () => {
    expect(getConfidenceLabel(80)).toBe("good");
    expect(getConfidenceLabel(85)).toBe("good");
    expect(getConfidenceLabel(89)).toBe("good");
  });

  it("returns 'moderate' for scores 60-79", () => {
    expect(getConfidenceLabel(60)).toBe("moderate");
    expect(getConfidenceLabel(70)).toBe("moderate");
    expect(getConfidenceLabel(79)).toBe("moderate");
  });

  it("returns 'low' for scores below 60", () => {
    expect(getConfidenceLabel(0)).toBe("low");
    expect(getConfidenceLabel(30)).toBe("low");
    expect(getConfidenceLabel(59)).toBe("low");
  });
});
