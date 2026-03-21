import { describe, expect, it } from "vitest";

import { mapSearchRows } from "../search-utils";

describe("mapSearchRows", () => {
  it("groups variants under their parent food", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        nutrientName: "Vitamin K",
        nutrientDisplayName: "Vitamin K",
        nutrientUnit: "mcg",
        valuePer100g: "482.9",
        confidenceScore: 95,
      },
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v2",
        preparationMethod: "boiled",
        isDefault: false,
        nutrientName: "Vitamin K",
        nutrientDisplayName: "Vitamin K",
        nutrientUnit: "mcg",
        valuePer100g: "360.0",
        confidenceScore: 85,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Spinach");
    expect(results[0].variants).toHaveLength(2);
    expect(results[0].variants[0].preparationMethod).toBe("raw");
    expect(results[0].variants[1].preparationMethod).toBe("boiled");
  });

  it("picks the highest-value nutrient as topNutrient per variant", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        nutrientName: "Vitamin K",
        nutrientDisplayName: "Vitamin K",
        nutrientUnit: "mcg",
        valuePer100g: "482.9",
        confidenceScore: 95,
      },
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        nutrientName: "Iron",
        nutrientDisplayName: "Iron",
        nutrientUnit: "mg",
        valuePer100g: "2.7",
        confidenceScore: 90,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results[0].variants[0].topNutrient?.name).toBe("Vitamin K");
    expect(results[0].variants[0].topNutrient?.valuePer100g).toBe(482.9);
  });

  it("handles variant with no nutrient data", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Unknown Food",
        category: null,
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        nutrientName: null,
        nutrientDisplayName: null,
        nutrientUnit: null,
        valuePer100g: null,
        confidenceScore: null,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(1);
    expect(results[0].variants[0].topNutrient).toBeNull();
  });

  it("returns empty array for empty input", () => {
    const results = mapSearchRows([]);
    expect(results).toHaveLength(0);
  });

  it("handles multiple foods", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        nutrientName: "Vitamin K",
        nutrientDisplayName: "Vitamin K",
        nutrientUnit: "mcg",
        valuePer100g: "482.9",
        confidenceScore: 95,
      },
      {
        foodId: "f2",
        foodName: "Broccoli",
        category: "vegetables",
        variantId: "v2",
        preparationMethod: "steamed",
        isDefault: true,
        nutrientName: "Vitamin C",
        nutrientDisplayName: "Vitamin C",
        nutrientUnit: "mg",
        valuePer100g: "64.9",
        confidenceScore: 88,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Spinach");
    expect(results[1].name).toBe("Broccoli");
  });
});
