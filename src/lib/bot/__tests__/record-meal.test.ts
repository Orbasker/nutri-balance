import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbWhere = vi.fn();
const mockInsertValues = vi.fn();
const mockDbInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: mockDbWhere,
        })),
        where: mockDbWhere,
      })),
    })),
    insert: mockDbInsert,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  ilike: vi.fn(),
  inArray: vi.fn(),
  or: vi.fn(),
}));

vi.mock("@/lib/calculations", () => ({
  calculateNutrientAmount: vi.fn(
    (_valuePer100g: number, portionGrams: number) => portionGrams / 10,
  ),
  getConfidenceLabel: vi.fn(),
  getNutrientStatus: vi.fn(),
}));

vi.mock("@/lib/db/schema/foods", () => ({
  foodAliases: {},
  foodVariants: { id: "food_variant_id", foodId: "food_id", preparationMethod: "method" },
  foods: { id: "food_id", name: "food_name", category: "category" },
  servingMeasures: {},
}));

vi.mock("@/lib/db/schema/nutrients", () => ({
  nutrients: {},
}));

vi.mock("@/lib/db/schema/reviews", () => ({
  resolvedNutrientValues: {
    nutrientId: "nutrient_id",
    valuePer100g: "value_per_100g",
    foodVariantId: "food_variant_id",
  },
}));

vi.mock("@/lib/db/schema/users", () => ({
  consumptionLogs: {
    id: "id",
    userId: "user_id",
    foodVariantId: "food_variant_id",
    servingMeasureId: "serving_measure_id",
    quantity: "quantity",
    nutrientSnapshot: "nutrient_snapshot",
    mealLabel: "meal_label",
    loggedAt: "logged_at",
  },
  userNutrientLimits: {},
}));

describe("recordMeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes an explicit UUID when saving a meal log", async () => {
    const { recordMeal } = await import("../tools");

    mockDbWhere
      .mockResolvedValueOnce([{ foodName: "Banana", method: "raw" }])
      .mockResolvedValueOnce([{ nutrientId: "nutrient-1", valuePer100g: "12.5" }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    const result = await recordMeal(
      {
        foodVariantId: "variant-1",
        quantity: 1,
        portionGrams: 118,
        mealLabel: "snack",
      },
      { userId: "user-1" },
    );

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        userId: "user-1",
        foodVariantId: "variant-1",
        servingMeasureId: null,
        quantity: "1",
        nutrientSnapshot: { "nutrient-1": 11.8 },
        mealLabel: "snack",
      }),
    );
    expect(result).toEqual({
      success: true,
      logged: {
        food: "Banana",
        preparationMethod: "raw",
        quantity: 1,
        portionGrams: 118,
        mealLabel: "snack",
        nutrientCount: 1,
      },
    });
  });
});
