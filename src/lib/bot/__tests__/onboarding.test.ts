import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

import { handleOnboarding } from "../onboarding";

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/schema/platform-accounts", () => ({
  platformAccounts: {
    id: "id",
    userId: "user_id",
    platform: "platform",
    platformUserId: "platform_user_id",
    platformUsername: "platform_username",
    onboardingState: "onboarding_state",
    onboardingData: "onboarding_data",
    createdAt: "created_at",
  },
}));

vi.mock("@/lib/db/schema/users", () => ({
  profiles: {
    id: "id",
    displayName: "display_name",
    clinicalNotes: "clinical_notes",
    healthGoal: "health_goal",
  },
  userNutrientLimits: {
    id: "id",
    userId: "user_id",
    nutrientId: "nutrient_id",
    dailyLimit: "daily_limit",
    mode: "mode",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
}));

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-123",
    userId: "user-456",
    platform: "telegram" as const,
    platformUserId: "tg-789",
    platformUsername: "testuser",
    onboardingState: "new" as const,
    onboardingData: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function setupDbUpdateMock() {
  const mockSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);
}

describe("handleOnboarding", () => {
  let mockRespond: ((text: string) => Promise<unknown>) & ReturnType<typeof vi.fn>;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRespond = vi.fn().mockResolvedValue(undefined) as typeof mockRespond;
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);
    setupDbUpdateMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends welcome message and transitions to awaiting_name for new accounts", async () => {
    const account = makeAccount({ onboardingState: "new" });

    await handleOnboarding(account, "hello", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Welcome");
    expect(message).toContain("name");
  });

  it("saves display name and transitions to awaiting_goals", async () => {
    const account = makeAccount({ onboardingState: "awaiting_name" });

    await handleOnboarding(account, "Alice", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("goal");
  });

  it("presents nutrient presets after saving goals", async () => {
    const account = makeAccount({ onboardingState: "awaiting_goals" });

    await handleOnboarding(account, "Managing kidney disease", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Kidney");
    expect(message).toContain("Blood thinner");
    expect(message).toContain("General");
    expect(message).toContain("Custom");
  });

  it("selects kidney preset and transitions to awaiting_limits", async () => {
    const account = makeAccount({ onboardingState: "awaiting_nutrients" });

    await handleOnboarding(account, "1", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Potassium");
  });

  it("processes limit values one at a time in awaiting_limits", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_limits",
      onboardingData: {
        nutrients: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
        ],
        currentIndex: 0,
      },
    });

    mockSupabase.order.mockResolvedValue({
      data: [{ id: "nutrient-k", display_name: "Potassium", unit: "mg" }],
      error: null,
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await handleOnboarding(account, "3500", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Sodium");
  });

  it("handles custom nutrient selection (option 4 then comma input)", async () => {
    // User previously chose option "4" and got the numbered list.
    // Now they reply with "1,3" to select nutrients from the stored list.
    const account = makeAccount({
      onboardingState: "awaiting_nutrients",
      onboardingData: {
        nutrients: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
          { name: "Vitamin K", key: "vitamin_k" },
        ],
        currentIndex: -1, // indicates custom mode
      },
    });

    await handleOnboarding(account, "1,3", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    // Should transition to awaiting_limits with the selected nutrients
    expect(message).toContain("Potassium");
    expect(message).toContain("Vitamin K");
    // Should NOT contain Sodium (not selected)
    expect(message).not.toContain("Sodium");
  });

  it("re-prompts on invalid custom nutrient selection numbers", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_nutrients",
      onboardingData: {
        nutrients: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
        ],
        currentIndex: -1,
      },
    });

    await handleOnboarding(account, "0,5", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    // Should ask user to try again with valid numbers
    expect(message).toMatch(/valid|invalid|between|range/i);
  });

  it("resets onboarding when user sends /restart", async () => {
    const account = makeAccount({ onboardingState: "awaiting_limits" });

    await handleOnboarding(account, "/restart", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    // Must contain restart/reset language AND the welcome message
    expect(message).toMatch(/reset|restart|fresh/i);
    expect(message).toContain("start");
  });

  it("resets onboarding when user sends restart (no slash)", async () => {
    const account = makeAccount({ onboardingState: "awaiting_nutrients" });

    await handleOnboarding(account, "restart", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toMatch(/reset|restart|fresh/i);
  });

  it("resets to new and restarts on unexpected onboarding state", async () => {
    const account = makeAccount({ onboardingState: "bogus_state" });

    await handleOnboarding(account, "hello", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toMatch(/wrong|restart|start/i);
    // Should have called db.update to reset state
    expect(db.update).toHaveBeenCalled();
  });

  it("completes onboarding when all limits are set", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_limits",
      onboardingData: {
        nutrients: [{ name: "Potassium", key: "potassium" }],
        currentIndex: 0,
      },
    });

    mockSupabase.order.mockResolvedValue({
      data: [{ id: "nutrient-k", display_name: "Potassium", unit: "mg" }],
      error: null,
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await handleOnboarding(account, "3500", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("complete");
  });
});
