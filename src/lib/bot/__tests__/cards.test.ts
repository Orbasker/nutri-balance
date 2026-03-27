import { describe, expect, it } from "vitest";

import {
  formatCanIEatCard,
  formatDailySummaryCard,
  formatFoodSearchCard,
  formatMealLoggedCard,
} from "../cards";

describe("formatCanIEatCard", () => {
  it("returns a card with verdict and nutrient rows for a safe food", () => {
    const result = {
      food: "Banana",
      preparationMethod: "raw",
      portionGrams: 120,
      overallVerdict: "safe" as const,
      trackedNutrients: [
        {
          nutrient: "Potassium",
          unit: "mg",
          consumedToday: 500,
          adding: 422,
          newTotal: 922,
          dailyLimit: 3500,
          percentOfLimit: 26,
          status: "safe" as const,
        },
        {
          nutrient: "Sodium",
          unit: "mg",
          consumedToday: 800,
          adding: 1,
          newTotal: 801,
          dailyLimit: 2000,
          percentOfLimit: 40,
          status: "safe" as const,
        },
      ],
    };

    const card = formatCanIEatCard(result);
    expect(card).toBeDefined();
    // Card text should contain the food name and verdict
    const text = JSON.stringify(card);
    expect(text).toContain("Banana");
    expect(text).toContain("SAFE");
    expect(text).toContain("Potassium");
    expect(text).toContain("Sodium");
  });

  it("shows caution emoji for caution verdict", () => {
    const result = {
      food: "Chips",
      preparationMethod: "fried",
      portionGrams: 150,
      overallVerdict: "caution" as const,
      trackedNutrients: [
        {
          nutrient: "Sodium",
          unit: "mg",
          consumedToday: 1500,
          adding: 400,
          newTotal: 1900,
          dailyLimit: 2000,
          percentOfLimit: 95,
          status: "caution" as const,
        },
      ],
    };

    const card = formatCanIEatCard(result);
    const text = JSON.stringify(card);
    expect(text).toContain("CAUTION");
  });

  it("shows exceed emoji for exceed verdict", () => {
    const result = {
      food: "Pickle",
      preparationMethod: "brined",
      portionGrams: 100,
      overallVerdict: "exceed" as const,
      trackedNutrients: [
        {
          nutrient: "Sodium",
          unit: "mg",
          consumedToday: 1900,
          adding: 500,
          newTotal: 2400,
          dailyLimit: 2000,
          percentOfLimit: 120,
          status: "exceed" as const,
        },
      ],
    };

    const card = formatCanIEatCard(result);
    const text = JSON.stringify(card);
    expect(text).toContain("EXCEED");
  });
});

describe("formatDailySummaryCard", () => {
  it("returns a card with daily nutrient progress", () => {
    const summary = {
      nutrients: [
        {
          nutrient: "Potassium",
          unit: "mg",
          consumed: 1500,
          dailyLimit: 3500,
          percentOfLimit: 43,
          status: "safe" as const,
        },
        {
          nutrient: "Sodium",
          unit: "mg",
          consumed: 1800,
          dailyLimit: 2000,
          percentOfLimit: 90,
          status: "caution" as const,
        },
      ],
      mealsLogged: 3,
    };

    const card = formatDailySummaryCard(summary);
    expect(card).toBeDefined();
    const text = JSON.stringify(card);
    expect(text).toContain("Potassium");
    expect(text).toContain("Sodium");
    expect(text).toContain("3");
  });
});

describe("formatFoodSearchCard", () => {
  it("returns a card with food results and web links", () => {
    const foods = [
      { id: "food-1", name: "Banana", category: "Fruit" },
      { id: "food-2", name: "Apple", category: "Fruit" },
    ];
    const appUrl = "https://nutri.example.com";

    const card = formatFoodSearchCard(foods, appUrl);
    expect(card).toBeDefined();
    const text = JSON.stringify(card);
    expect(text).toContain("Banana");
    expect(text).toContain("Apple");
    expect(text).toContain("https://nutri.example.com/food/food-1");
  });

  it("handles empty results", () => {
    const card = formatFoodSearchCard([], "https://app.example.com");
    expect(card).toBeDefined();
    const text = JSON.stringify(card);
    expect(text).toContain("No foods found");
  });
});

describe("formatMealLoggedCard", () => {
  it("returns a confirmation card with nutrient impact", () => {
    const result = {
      food: "Banana",
      portionGrams: 120,
      mealLabel: "snack",
      nutrients: [
        { nutrient: "Potassium", unit: "mg", amount: 422 },
        { nutrient: "Sodium", unit: "mg", amount: 1 },
      ],
    };

    const card = formatMealLoggedCard(result);
    expect(card).toBeDefined();
    const text = JSON.stringify(card);
    expect(text).toContain("Banana");
    expect(text).toContain("120g");
    expect(text).toContain("Potassium");
  });
});
