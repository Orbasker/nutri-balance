import { describe, expect, it, vi } from "vitest";

import { findOrCreatePlatformAccount } from "@/lib/bot/user-linking";

const mockDbWhere = vi.fn().mockResolvedValue([]);
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
  streamText: vi.fn().mockReturnValue({
    fullStream: (async function* () {})(),
    text: Promise.resolve("Test reply"),
  }),
  stepCountIs: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockDbWhere,
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
    enum: vi.fn().mockReturnValue({
      optional: vi.fn().mockReturnValue({ describe: vi.fn().mockReturnValue({}) }),
      describe: vi.fn().mockReturnValue({}),
    }),
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
  it("posts finalized plain text replies for Telegram threads", async () => {
    const { getBot } = await import("../index");
    getBot();
    const handler = mockBot.onNewMention.mock.calls[0][0];

    const mockPost = vi.fn().mockResolvedValue(undefined);
    const mockThread = {
      id: "telegram:chat-789",
      post: mockPost,
      subscribe: vi.fn().mockResolvedValue(undefined),
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {})(),
    };
    const mockMessage = {
      text: "hello",
      author: { userId: "tg-123", userName: "tester", fullName: "Tester" },
    };

    vi.mocked(findOrCreatePlatformAccount).mockResolvedValueOnce({
      id: "platform-account-1",
      createdAt: new Date(),
      userId: "user-123",
      platform: "telegram",
      platformUserId: "tg-123",
      platformUsername: "tester",
      onboardingState: "complete",
      onboardingData: null,
    });

    await handler(mockThread, mockMessage);

    expect(mockPost).toHaveBeenCalledWith("Test reply");
  });

  it("uses tool-aware fallback text when Telegram gets no final model text", async () => {
    const { getBot } = await import("../index");
    const { streamText } = await import("ai");

    vi.mocked(streamText).mockImplementationOnce(((options: {
      onStepFinish?: (payload: { toolCalls?: unknown[]; toolResults?: unknown[] }) => void;
    }) => {
      options.onStepFinish?.({
        toolCalls: [
          {
            type: "tool-call",
            toolCallId: "tool-call-1",
            toolName: "aiResearchFood",
            input: { foodName: "אבטיח" },
          },
        ],
        toolResults: [{ success: false, error: "Provider timeout" }],
      });

      return {
        fullStream: (async function* () {})(),
        text: Promise.resolve(""),
      } as never;
    }) as never);

    getBot();
    const handler = mockBot.onNewMention.mock.calls[0][0];

    const mockPost = vi.fn().mockResolvedValue(undefined);
    const mockThread = {
      id: "telegram:chat-999",
      post: mockPost,
      subscribe: vi.fn().mockResolvedValue(undefined),
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {
        yield { text: "תחקור על אבטיח" };
      })(),
    };
    const mockMessage = {
      text: "למה?",
      author: { userId: "tg-123", userName: "tester", fullName: "Tester" },
    };

    vi.mocked(findOrCreatePlatformAccount).mockResolvedValueOnce({
      id: "platform-account-3",
      createdAt: new Date(),
      userId: "user-123",
      platform: "telegram",
      platformUserId: "tg-123",
      platformUsername: "tester",
      onboardingState: "complete",
      onboardingData: null,
    });

    await handler(mockThread, mockMessage);

    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("Provider timeout"));
  });

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
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("went wrong"));
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

    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("went wrong"));
  });

  it("keeps relinking available for users who want to switch to a different web account", async () => {
    const { getBot } = await import("../index");
    const { streamText } = await import("ai");

    getBot();
    const handler = mockBot.onNewMention.mock.calls[0][0];

    const mockPost = vi.fn().mockResolvedValue(undefined);
    const mockThread = {
      id: "telegram:chat-987",
      post: mockPost,
      subscribe: vi.fn().mockResolvedValue(undefined),
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {})(),
    };
    const mockMessage = {
      text: "can you disconnect and connect me again to my account?",
      author: { userId: "tg-456", userName: "or", fullName: "Or" },
    };

    vi.mocked(findOrCreatePlatformAccount).mockResolvedValueOnce({
      id: "platform-account-2",
      createdAt: new Date(),
      userId: "user-linked-1",
      platform: "telegram",
      platformUserId: "tg-456",
      platformUsername: "or",
      onboardingState: "complete",
      onboardingData: null,
    });

    mockDbWhere
      .mockResolvedValueOnce([{ email: "or@example.com" }])
      .mockResolvedValueOnce([
        { displayName: "Or", clinicalNotes: null, healthGoal: "Keep my intake steady" },
      ])
      .mockResolvedValueOnce([]);

    await handler(mockThread, mockMessage);

    const lastCall = vi.mocked(streamText).mock.calls.at(-1)?.[0];
    expect(lastCall).toBeDefined();
    expect(lastCall?.system).toContain("there is usually no need because sync is already active");
    expect(lastCall?.system).toContain(
      "If they want to connect this bot to a DIFFERENT web account",
    );
    expect(lastCall?.system).toContain("Daily log:");
    expect(lastCall?.system).toContain("Dashboard:");
    expect(Object.keys(lastCall?.tools ?? {})).toContain("linkWebAccount");
    expect(mockPost).toHaveBeenCalledWith("Test reply");
  });

  it("logs tool business failures as errors in onStepFinish", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { getBot } = await import("../index");
    const { streamText } = await import("ai");

    getBot();
    const handler = mockBot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "telegram:chat-654",
      post: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      startTyping: vi.fn().mockResolvedValue(undefined),
      allMessages: (async function* () {})(),
    };
    const mockMessage = {
      text: "log a banana",
      author: { userId: "tg-654", userName: "or", fullName: "Or" },
    };

    vi.mocked(findOrCreatePlatformAccount).mockResolvedValueOnce({
      id: "platform-account-3",
      createdAt: new Date(),
      userId: "user-654",
      platform: "telegram",
      platformUserId: "tg-654",
      platformUsername: "or",
      onboardingState: "complete",
      onboardingData: null,
    });

    mockDbWhere
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ displayName: "Or", clinicalNotes: null, healthGoal: "steady" }])
      .mockResolvedValueOnce([]);

    await handler(mockThread, mockMessage);

    const lastCall = vi.mocked(streamText).mock.calls.at(-1)?.[0];
    await lastCall?.onStepFinish?.({
      toolCalls: [{ toolName: "recordMeal" } as never],
      toolResults: [{ success: true, output: { success: false, error: "db failed" } } as never],
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      "[NutriBalance Bot] Tool: recordMeal",
      JSON.stringify({
        toolName: "recordMeal",
        error: { success: false, error: "db failed" },
      }),
    );

    logSpy.mockRestore();
  });
});
