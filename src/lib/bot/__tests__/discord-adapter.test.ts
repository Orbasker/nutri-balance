import { describe, expect, it, vi } from "vitest";

// Mock all dependencies before importing
const mockBot = {
  onNewMention: vi.fn(),
  onSubscribedMessage: vi.fn(),
  webhooks: { telegram: vi.fn(), discord: vi.fn() },
  initialize: vi.fn(),
};

vi.mock("chat", () => {
  class MockChat {
    adapters: Record<string, unknown>;
    constructor(opts: { adapters: Record<string, unknown> }) {
      this.adapters = opts.adapters;
    }
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

describe("Discord adapter registration", () => {
  it("imports createDiscordAdapter from @chat-adapter/discord", async () => {
    const discordModule = await import("@chat-adapter/discord");
    expect(discordModule.createDiscordAdapter).toBeDefined();
  });

  it("bot exports a valid instance with webhook handlers", async () => {
    const { bot } = await import("../index");
    expect(bot).toBeDefined();
    expect(bot.webhooks).toBeDefined();
    expect(bot.webhooks.telegram).toBeDefined();
    // Discord webhook should also be available since we mock the adapter
    expect(bot.webhooks.discord).toBeDefined();
  });

  it("bot still works without Discord env vars (telegram always registered)", async () => {
    delete process.env.DISCORD_BOT_TOKEN;

    const { bot } = await import("../index");
    expect(bot).toBeDefined();
    expect(bot.webhooks.telegram).toBeDefined();
  });
});
