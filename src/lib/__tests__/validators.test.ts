import { describe, expect, it } from "vitest";

import { searchInputSchema } from "@/lib/validators";

describe("searchInputSchema", () => {
  it("accepts a valid search query", () => {
    const result = searchInputSchema.safeParse({ query: "spinach" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("spinach");
    }
  });

  it("trims whitespace from query", () => {
    const result = searchInputSchema.safeParse({ query: "  spinach  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("spinach");
    }
  });

  it("rejects empty query", () => {
    const result = searchInputSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only query", () => {
    const result = searchInputSchema.safeParse({ query: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects query shorter than 2 characters", () => {
    const result = searchInputSchema.safeParse({ query: "a" });
    expect(result.success).toBe(false);
  });

  it("accepts query with exactly 2 characters", () => {
    const result = searchInputSchema.safeParse({ query: "ab" });
    expect(result.success).toBe(true);
  });

  it("rejects query longer than 100 characters", () => {
    const result = searchInputSchema.safeParse({ query: "a".repeat(101) });
    expect(result.success).toBe(false);
  });
});
