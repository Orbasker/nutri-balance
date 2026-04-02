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
        substanceName: "Vitamin K",
        substanceDisplayName: "Vitamin K",
        substanceUnit: "mcg",
        valuePer100g: "482.9",
        confidenceScore: 95,
        sourceSummary: null,
      },
      {
        foodId: "f1",
        foodName: "Spinach",
        category: "vegetables",
        variantId: "v2",
        preparationMethod: "boiled",
        isDefault: false,
        substanceName: "Vitamin K",
        substanceDisplayName: "Vitamin K",
        substanceUnit: "mcg",
        valuePer100g: "360.0",
        confidenceScore: 85,
        sourceSummary: null,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Spinach");
    expect(results[0].variants).toHaveLength(2);
    expect(results[0].variants[0].preparationMethod).toBe("raw");
    expect(results[0].variants[1].preparationMethod).toBe("boiled");
  });

  it("picks the most nutritionally prominent substance as topSubstance per variant", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Carrot",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        substanceName: "vitamin_a",
        substanceDisplayName: "Vitamin A",
        substanceUnit: "mcg",
        valuePer100g: "835",
        confidenceScore: 95,
        sourceSummary: null,
      },
      {
        foodId: "f1",
        foodName: "Carrot",
        category: "vegetables",
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        substanceName: "niacin",
        substanceDisplayName: "Vitamin B3 (Niacin)",
        substanceUnit: "mg",
        valuePer100g: "1.3",
        confidenceScore: 90,
        sourceSummary: null,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results[0].variants[0].topSubstance?.name).toBe("vitamin_a");
    expect(results[0].variants[0].topSubstance?.valuePer100g).toBe(835);
  });

  it("handles variant with no substance data", () => {
    const rows = [
      {
        foodId: "f1",
        foodName: "Unknown Food",
        category: null,
        variantId: "v1",
        preparationMethod: "raw",
        isDefault: true,
        substanceName: null,
        substanceDisplayName: null,
        substanceUnit: null,
        valuePer100g: null,
        confidenceScore: null,
        sourceSummary: null,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(1);
    expect(results[0].variants[0].topSubstance).toBeNull();
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
        substanceName: "Vitamin K",
        substanceDisplayName: "Vitamin K",
        substanceUnit: "mcg",
        valuePer100g: "482.9",
        confidenceScore: 95,
        sourceSummary: null,
      },
      {
        foodId: "f2",
        foodName: "Broccoli",
        category: "vegetables",
        variantId: "v2",
        preparationMethod: "steamed",
        isDefault: true,
        substanceName: "Vitamin C",
        substanceDisplayName: "Vitamin C",
        substanceUnit: "mg",
        valuePer100g: "64.9",
        confidenceScore: 88,
        sourceSummary: null,
      },
    ];

    const results = mapSearchRows(rows);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Spinach");
    expect(results[1].name).toBe("Broccoli");
  });
});
