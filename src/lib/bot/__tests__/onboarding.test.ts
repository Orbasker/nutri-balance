import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { handleOnboarding } from "../onboarding";

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("@/lib/db/schema/substances", () => ({
  substances: {
    id: "id",
    displayName: "display_name",
    unit: "unit",
    sortOrder: "sort_order",
  },
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
  userSubstanceLimits: {
    id: "id",
    userId: "user_id",
    substanceId: "substance_id",
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

function setupDbSelectMock(results: unknown[] = []) {
  const mockOrderBy = vi.fn().mockResolvedValue(results);
  const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
}

describe("handleOnboarding", () => {
  let mockRespond: ((text: string) => Promise<unknown>) & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRespond = vi.fn().mockResolvedValue(undefined) as typeof mockRespond;
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

  it("presents substance presets after saving goals", async () => {
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
    const account = makeAccount({ onboardingState: "awaiting_substances" });

    await handleOnboarding(account, "1", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Potassium");
  });

  it("processes limit values one at a time in awaiting_limits", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_limits",
      onboardingData: {
        substances: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
        ],
        currentIndex: 0,
      },
    });

    setupDbSelectMock([{ id: "substance-k", displayName: "Potassium", unit: "mg" }]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await handleOnboarding(account, "3500", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Sodium");
  });

  it("handles custom substance selection (option 4 then comma input)", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_substances",
      onboardingData: {
        substances: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
          { name: "Vitamin K", key: "vitamin_k" },
        ],
        currentIndex: -1,
      },
    });

    await handleOnboarding(account, "1,3", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("Potassium");
    expect(message).toContain("Vitamin K");
    expect(message).not.toContain("Sodium");
  });

  it("re-prompts on invalid custom substance selection numbers", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_substances",
      onboardingData: {
        substances: [
          { name: "Potassium", key: "potassium" },
          { name: "Sodium", key: "sodium" },
        ],
        currentIndex: -1,
      },
    });

    await handleOnboarding(account, "0,5", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toMatch(/valid|invalid|between|range/i);
  });

  it("resets onboarding when user sends /restart", async () => {
    const account = makeAccount({ onboardingState: "awaiting_limits" });

    await handleOnboarding(account, "/restart", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toMatch(/reset|restart|fresh/i);
    expect(message).toContain("start");
  });

  it("resets onboarding when user sends restart (no slash)", async () => {
    const account = makeAccount({ onboardingState: "awaiting_substances" });

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
    expect(db.update).toHaveBeenCalled();
  });

  it("completes onboarding when all limits are set", async () => {
    const account = makeAccount({
      onboardingState: "awaiting_limits",
      onboardingData: {
        substances: [{ name: "Potassium", key: "potassium" }],
        currentIndex: 0,
      },
    });

    setupDbSelectMock([{ id: "substance-k", displayName: "Potassium", unit: "mg" }]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await handleOnboarding(account, "3500", mockRespond);

    expect(mockRespond).toHaveBeenCalledTimes(1);
    const message = mockRespond.mock.calls[0][0] as string;
    expect(message).toContain("complete");
  });
});
