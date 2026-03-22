import { describe, expect, it, vi } from "vitest";

// Mock the DB module before imports
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}));

// Mock supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user" } } }),
    },
  }),
}));

// Mock AI agents
vi.mock("@/lib/ai/food-search-agent", () => ({
  aiResearchFood: vi.fn(),
}));
vi.mock("@/lib/ai/nutrient-search-agent", () => ({
  aiSearchByNutrient: vi.fn(),
}));
vi.mock("@/lib/ai/pdf-food-parser", () => ({
  parsePdfToFoods: vi.fn(),
}));

// Mock validators
vi.mock("@/lib/validators", () => ({
  searchInputSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: { query: "test" } }),
  },
}));

describe("listNutrients", () => {
  it("returns nutrients sorted by sortOrder", async () => {
    const mockNutrients = [
      { id: "n1", name: "vitamin_c", displayName: "Vitamin C", unit: "mg" },
      { id: "n2", name: "iron", displayName: "Iron", unit: "mg" },
    ];

    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(mockNutrients),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { listNutrients } = await import("../actions");
    const result = await listNutrients();

    expect(result).toEqual([
      { id: "n1", name: "vitamin_c", displayName: "Vitamin C", unit: "mg" },
      { id: "n2", name: "iron", displayName: "Iron", unit: "mg" },
    ]);
  });

  it("returns empty array when no nutrients exist", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { listNutrients } = await import("../actions");
    const result = await listNutrients();

    expect(result).toEqual([]);
  });
});

describe("searchByNutrientId", () => {
  it("is exported as a function", async () => {
    const actions = await import("../actions");
    expect(typeof actions.searchByNutrientId).toBe("function");
  });
});
