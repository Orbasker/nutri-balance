import { describe, expect, it, vi } from "vitest";

// Mock the DB module before imports
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}));

// Mock auth session
vi.mock("@/lib/auth-session", () => ({
  getSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "test@example.com", name: "Test" },
    session: { id: "s1", token: "tok" },
  }),
}));

// Mock AI agents
vi.mock("@/lib/ai/food-search-agent", () => ({
  aiResearchFood: vi.fn(),
}));
vi.mock("@/lib/ai/substance-search-agent", () => ({
  aiSearchBySubstance: vi.fn(),
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

describe("listSubstances", () => {
  it("returns substances sorted by sortOrder", async () => {
    const mockSubstances = [
      { id: "n1", name: "vitamin_c", displayName: "Vitamin C", unit: "mg" },
      { id: "n2", name: "iron", displayName: "Iron", unit: "mg" },
    ];

    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(mockSubstances),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { listSubstances } = await import("../actions");
    const result = await listSubstances();

    expect(result).toEqual([
      { id: "n1", name: "vitamin_c", displayName: "Vitamin C", unit: "mg" },
      { id: "n2", name: "iron", displayName: "Iron", unit: "mg" },
    ]);
  });

  it("returns empty array when no substances exist", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { listSubstances } = await import("../actions");
    const result = await listSubstances();

    expect(result).toEqual([]);
  });
});

describe("searchBySubstanceId", () => {
  it("is exported as a function", async () => {
    const actions = await import("../actions");
    expect(typeof actions.searchBySubstanceId).toBe("function");
  });
});
