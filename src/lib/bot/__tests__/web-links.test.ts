import { describe, expect, it, vi } from "vitest";

// We need to test that buildSystemPrompt includes web links.
// Since buildSystemPrompt is not exported, we test via the APP_URL constant export.
// Actually, let's test the exported getWebLinks helper.

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ displayName: "Test User", clinicalNotes: null }]),
      }),
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
  relations: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  ilike: vi.fn(),
}));

vi.mock("@/lib/db/schema/users", () => ({
  profiles: { id: "id", displayName: "display_name", clinicalNotes: "clinical_notes" },
}));

vi.mock("@/lib/db/schema/nutrients", () => ({
  nutrients: { id: "id", displayName: "display_name", unit: "unit", sortOrder: "sort_order" },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

describe("web links in bot", () => {
  it("getWebLinksBlock returns formatted web link instructions", async () => {
    const { getWebLinksBlock } = await import("../web-links");
    const block = getWebLinksBlock("https://nutri.example.com");
    expect(block).toContain("https://nutri.example.com/settings");
    expect(block).toContain("https://nutri.example.com/log");
    expect(block).toContain("https://nutri.example.com/dashboard");
    expect(block).toContain("/food/");
  });

  it("uses default localhost URL when no APP_URL set", async () => {
    const { getWebLinksBlock } = await import("../web-links");
    const block = getWebLinksBlock();
    expect(block).toContain("http://localhost:3000");
  });
});
