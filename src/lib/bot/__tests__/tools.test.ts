import { describe, expect, it } from "vitest";

import type { ToolContext } from "@/lib/bot/tools";
import {
  aiResearchFood,
  checkCanIEat,
  getDailySummary,
  getFoodNutrients,
  recordMeal,
  searchFood,
} from "@/lib/bot/tools";

describe("shared tool exports", () => {
  it("exports searchFood as a function", () => {
    expect(typeof searchFood).toBe("function");
  });

  it("exports getFoodNutrients as a function", () => {
    expect(typeof getFoodNutrients).toBe("function");
  });

  it("exports checkCanIEat as a function", () => {
    expect(typeof checkCanIEat).toBe("function");
  });

  it("exports recordMeal as a function", () => {
    expect(typeof recordMeal).toBe("function");
  });

  it("exports getDailySummary as a function", () => {
    expect(typeof getDailySummary).toBe("function");
  });

  it("exports aiResearchFood as a function", () => {
    expect(typeof aiResearchFood).toBe("function");
  });

  it("ToolContext interface accepts userId and supabase", () => {
    // Type-level check that ToolContext has the expected shape
    const ctx: ToolContext = {
      userId: "test-user-id",
      supabase: {} as ToolContext["supabase"],
    };
    expect(ctx.userId).toBe("test-user-id");
    expect(ctx.supabase).toBeDefined();
  });
});
