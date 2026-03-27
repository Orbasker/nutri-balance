import { describe, expect, it, vi } from "vitest";

import { findOrCreatePlatformAccount } from "@/lib/bot/user-linking";

const mockBot = {
  onNewMention: vi.fn(),
  onSubscribedMessage: vi.fn(),
  webhooks: { telegram: vi.fn() },
  initialize: vi.fn(),
};

vi.mock("chat", () => {
  class MockChat {
    onNewMention = mockBot.onNewMention;
    onSubscribedMessage = mockBot.onSubscribedMessage;
    webhooks = mockBot.webhooks;
    initialize = mockBot.initialize;
  }
  return {
    Chat: MockChat,
    toAiMessages: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@chat-adapter/telegram", () => ({
  createTelegramAdapter: vi.fn().mockReturnValue({ name: "telegram" }),
}));

vi.mock("@chat-adapter/discord", () => ({
  createDiscordAdapter: vi.fn().mockReturnValue({ name: "discord" }),
}));

vi.mock("@chat-adapter/state-memory", () => ({
  createMemoryState: vi.fn().mockReturnValue({ name: "memory" }),
}));

vi.mock("@/lib/bot/user-linking", () => ({
  findOrCreatePlatformAccount: vi.fn(),
}));

vi.mock("@/lib/bot/onboarding", () => ({
  handleOnboarding: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

vi.mock("@/lib/ai-provider", () => ({
  getModel: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText: vi.fn().mockReturnValue({ fullStream: (async function* () {})() }),
  stepCountIs: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
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
  userNutrientLimits: {
    id: "id",
    userId: "user_id",
    nutrientId: "nutrient_id",
    dailyLimit: "daily_limit",
    mode: "mode",
  },
  profilesRelations: {},
  userNutrientLimitsRelations: {},
  consumptionLogs: {},
  consumptionLogsRelations: {},
  userRoleEnum: vi.fn(),
  limitModeEnum: vi.fn(),
}));

vi.mock("@/lib/db/schema/nutrients", () => ({
  nutrients: { id: "id", displayName: "display_name", unit: "unit", sortOrder: "sort_order" },
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
  platformAccountRelations: {},
  platformEnum: vi.fn(),
  onboardingStateEnum: vi.fn(),
}));

vi.mock("@/lib/db/schema/foods", () => ({
  foods: { id: "id", name: "name", category: "category" },
  foodAliases: { foodId: "food_id", alias: "alias" },
  foodVariants: {
    id: "id",
    foodId: "food_id",
    preparationMethod: "preparation_method",
    isDefault: "is_default",
  },
  servingMeasures: {
    id: "id",
    foodVariantId: "food_variant_id",
    label: "label",
    gramsEquivalent: "grams_equivalent",
  },
}));

vi.mock("@/lib/db/schema/reviews", () => ({
  resolvedNutrientValues: {
    nutrientId: "nutrient_id",
    valuePer100g: "value_per_100g",
    confidenceScore: "confidence_score",
    foodVariantId: "food_variant_id",
  },
}));

vi.mock("@/lib/calculations", () => ({
  calculateNutrientAmount: vi.fn(),
  getConfidenceLabel: vi.fn(),
  getNutrientStatus: vi.fn(),
}));

vi.mock("zod", () => ({
  z: {
    object: vi.fn().mockReturnValue({}),
    string: vi.fn().mockReturnValue({
      describe: vi.fn().mockReturnValue({}),
      optional: vi.fn().mockReturnValue({ describe: vi.fn().mockReturnValue({}) }),
    }),
    number: vi.fn().mockReturnValue({
      describe: vi.fn().mockReturnValue({}),
      positive: vi.fn().mockReturnValue({ describe: vi.fn().mockReturnValue({}) }),
    }),
  },
}));

describe("bot core module", () => {
  it("exports a getBot function that returns a bot instance with webhooks", async () => {
    const { getBot } = await import("../index");
    const bot = getBot();
    expect(bot).toBeDefined();
    expect(bot.webhooks).toBeDefined();
    expect(bot.webhooks.telegram).toBeDefined();
  });

  it("registers onNewMention handler", async () => {
    const { getBot } = await import("../index");
    getBot();
    expect(mockBot.onNewMention).toHaveBeenCalled();
  });

  it("registers onSubscribedMessage handler", async () => {
    const { getBot } = await import("../index");
    getBot();
    expect(mockBot.onSubscribedMessage).toHaveBeenCalled();
  });
});

describe("bot handler error recovery", () => {
  it("onNewMention handler catches errors and posts error message", async () => {
    // Ensure bot is initialised so handlers are registered
    const { getBot } = await import("../index");
    getBot();
    // Get the handler that was registered
    const handler = mockBot.onNewMention.mock.calls[0][0];

    // Mock thread and message
    const mockPost = vi.fn().mockResolvedValue(undefined);
    const mockThread = {
      id: "telegram:chat-123",
      post: mockPost,
      subscribe: vi.fn().mockResolvedValue(undefined),
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {})(),
    };
    const mockMessage = {
      text: "hello",
      author: { userId: "tg-999", userName: "crasher", fullName: "Crasher" },
    };

    // Make resolveAccount throw
    vi.mocked(findOrCreatePlatformAccount).mockRejectedValueOnce(new Error("DB connection failed"));

    // Should NOT throw - error should be caught
    await handler(mockThread, mockMessage);

    // Should have posted an error message to the thread
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("Sorry"));
  });

  it("onSubscribedMessage handler catches errors and posts error message", async () => {
    const { getBot } = await import("../index");
    getBot();
    const handler = mockBot.onSubscribedMessage.mock.calls[0][0];

    const mockPost = vi.fn().mockResolvedValue(undefined);
    const mockThread = {
      id: "telegram:chat-456",
      post: mockPost,
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {})(),
    };
    const mockMessage = {
      text: "test",
      author: { userId: "tg-888", userName: "crasher2", fullName: "Crasher2" },
    };

    vi.mocked(findOrCreatePlatformAccount).mockRejectedValueOnce(new Error("DB connection failed"));

    await handler(mockThread, mockMessage);

    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("Sorry"));
  });
});
