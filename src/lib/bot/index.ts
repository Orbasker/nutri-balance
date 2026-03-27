import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { stepCountIs, streamText } from "ai";
import { Chat, toAiMessages } from "chat";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import type { ToolContext } from "@/lib/bot/tools";
import {
  aiResearchFood,
  checkCanIEat,
  getDailySummary,
  getFoodNutrients,
  recordMeal,
  searchFood,
} from "@/lib/bot/tools";
import { db } from "@/lib/db";
import { nutrients } from "@/lib/db/schema/nutrients";
import { profiles, userNutrientLimits } from "@/lib/db/schema/users";

import { handleOnboarding } from "./onboarding";
import { findOrCreatePlatformAccount } from "./user-linking";
import { getWebLinksBlock } from "./web-links";

let _bot: Chat | null = null;

/**
 * Lazily initialise the Chat bot so that importing this module during build
 * (when env vars like TELEGRAM_BOT_TOKEN are absent) does not throw.
 */
export function getBot(): Chat {
  if (_bot) return _bot;

  const telegram = createTelegramAdapter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapters: Record<string, any> = { telegram };

  if (process.env.DISCORD_BOT_TOKEN) {
    adapters.discord = createDiscordAdapter();
  }

  const hasPostgresState = Boolean(process.env.POSTGRES_URL) || Boolean(process.env.DATABASE_URL);
  const state = hasPostgresState ? createPostgresState() : createMemoryState();

  _bot = new Chat({
    userName: "nutribalance",
    adapters,
    state,
    concurrency: { strategy: "queue" },
  });

  // Register handlers on the freshly-created instance
  registerHandlers(_bot);

  return _bot;
}

/**
 * Build the system prompt for the AI, same as the web chat route.
 */
async function buildSystemPrompt(userId: string): Promise<string> {
  const [profile] = await db
    .select({ displayName: profiles.displayName, clinicalNotes: profiles.clinicalNotes })
    .from(profiles)
    .where(eq(profiles.id, userId));

  const userLimits = await db
    .select({
      nutrient_id: userNutrientLimits.nutrientId,
      daily_limit: userNutrientLimits.dailyLimit,
      mode: userNutrientLimits.mode,
    })
    .from(userNutrientLimits)
    .where(eq(userNutrientLimits.userId, userId));

  const limitNutrientIds = userLimits.map((l) => l.nutrient_id);
  let limitsContext = "";
  if (limitNutrientIds.length > 0) {
    const nutrientRows = await db
      .select({ id: nutrients.id, displayName: nutrients.displayName, unit: nutrients.unit })
      .from(nutrients)
      .where(inArray(nutrients.id, limitNutrientIds));
    const nutrientMap = new Map(nutrientRows.map((n) => [n.id, n]));

    limitsContext = userLimits
      .map((l) => {
        const n = nutrientMap.get(l.nutrient_id);
        if (!n) return null;
        return `- ${n.displayName}: ${l.daily_limit} ${n.unit}/day (${l.mode} mode)`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return `You are NutriBalance Assistant, a specialized nutrition agent for ${profile?.displayName ?? "the user"}.

IMPORTANT PRIVACY RULES:
- You ONLY discuss this specific user's dietary data, limits, and food logs. Never reference other users.
- All data you access is private to this user, protected by row-level security.
- If asked about other people's diets, politely decline.

YOUR CAPABILITIES:
- Search for foods in the database and check their nutrient content
- Check if the user can safely eat a specific food today (based on their daily limits and what they've already eaten)
- Record meals / log food consumption
- Provide the user's current daily nutrient summary
- Research foods not in the database using AI (triggers background research)

USER'S NUTRIENT LIMITS:
${limitsContext || "No limits configured yet. Suggest they set up limits in Settings."}

${profile?.clinicalNotes ? `CLINICAL NOTES:\n${profile.clinicalNotes}` : ""}

${getWebLinksBlock()}

RESPONSE STYLE:
- CRITICAL: You MUST always write a text response after using tools. Never end your turn with only tool calls. Summarize what you found and answer the user's question in plain language.
- Be concise and direct
- When checking if the user can eat something, always show: current intake, what the food would add, new total, and the limit
- Use status indicators: safe (<80% of limit), caution (80-100%), exceed (>100%)
- When recording a meal, confirm what was logged with the nutrient impact
- If a food isn't found, offer to research it using AI

TOOL USAGE:
- To answer "can I eat X", first searchFood to find the food, then use checkCanIEat with the default variant ID and a reasonable portion (e.g. 120g for a medium fruit, 200g for a cooked portion). Then write your answer.
- To record a meal, first searchFood, then use recordMeal with the variant ID, portion grams, and meal label. Then confirm what was logged.
- Always chain the tools you need, then summarize the results conversationally.`;
}

/**
 * Build AI tool definitions with the given context.
 */
function buildTools(toolCtx: ToolContext) {
  return {
    searchFood: {
      description:
        "Search for a food in the database by name. Returns matching foods with their variants and nutrient data.",
      inputSchema: z.object({
        query: z.string().describe("The food name to search for"),
      }),
      execute: async (params: { query: string }) => searchFood(params, toolCtx),
    },
    getFoodNutrients: {
      description:
        "Get the full nutrient breakdown for a specific food variant. Use after searchFood to get detailed nutrient data.",
      inputSchema: z.object({
        foodVariantId: z.string().describe("The food variant ID to get nutrients for"),
      }),
      execute: async (params: { foodVariantId: string }) => getFoodNutrients(params, toolCtx),
    },
    checkCanIEat: {
      description:
        "Check if the user can safely eat a specific food today based on their daily nutrient limits and what they've already consumed. Shows impact analysis.",
      inputSchema: z.object({
        foodVariantId: z.string().describe("The food variant ID"),
        portionGrams: z.number().describe("How many grams the user wants to eat"),
      }),
      execute: async (params: { foodVariantId: string; portionGrams: number }) =>
        checkCanIEat(params, toolCtx),
    },
    recordMeal: {
      description:
        "Log a food consumption entry for the user. Records what they ate with nutrient snapshot for tracking.",
      inputSchema: z.object({
        foodVariantId: z.string().describe("The food variant ID from searchFood results"),
        servingMeasureId: z
          .string()
          .optional()
          .describe("The serving measure ID from searchFood results. Omit if not available."),
        quantity: z.number().positive().describe("Number of servings (or 1 if logging by grams)"),
        portionGrams: z.number().positive().describe("Total grams being consumed"),
        mealLabel: z
          .string()
          .optional()
          .describe("Optional meal label: breakfast, lunch, dinner, snack"),
      }),
      execute: async (params: {
        foodVariantId: string;
        servingMeasureId?: string;
        quantity: number;
        portionGrams: number;
        mealLabel?: string;
      }) => recordMeal(params, toolCtx),
    },
    getDailySummary: {
      description:
        "Get the user's nutrient intake summary for today. Shows consumed amounts vs daily limits.",
      inputSchema: z.object({}),
      execute: async () => getDailySummary({} as Record<string, never>, toolCtx),
    },
    aiResearchFood: {
      description:
        "Research a food not found in the database using AI. This triggers a background research process that creates the food with AI-generated nutrient estimates.",
      inputSchema: z.object({
        foodName: z.string().describe("The name of the food to research"),
      }),
      execute: async (params: { foodName: string }) => aiResearchFood(params, toolCtx),
    },
  };
}

/**
 * Handle an AI-powered message for an onboarded user.
 */
async function handleAiMessage(
  thread: Parameters<Parameters<Chat["onNewMention"]>[0]>[0],
  message: Parameters<Parameters<Chat["onNewMention"]>[0]>[1],
  userId: string,
) {
  const toolCtx: ToolContext = { userId };

  const systemPrompt = await buildSystemPrompt(userId);

  // Build conversation history from thread
  const messages = [];
  for await (const msg of thread.allMessages) {
    messages.push(msg);
  }
  const history = await toAiMessages(messages);

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: history,
    stopWhen: stepCountIs(5),
    tools: buildTools(toolCtx),
  });

  await thread.post(result.fullStream);
}

/**
 * Resolve the platform account for the message author.
 */
async function resolveAccount(
  adapterName: string,
  message: { author: { userId: string; userName: string; fullName: string } },
) {
  const platform = adapterName as "telegram" | "discord";
  const platformUserId = message.author.userId;
  const platformUsername = message.author.userName || message.author.fullName || null;

  return findOrCreatePlatformAccount(platform, platformUserId, platformUsername);
}

/**
 * Register event handlers on the bot instance. Called once during lazy init.
 */
function registerHandlers(bot: Chat) {
  // Handle new mentions (including DMs which auto-set isMention=true)
  bot.onNewMention(async (thread, message) => {
    try {
      const adapterName = thread.id.split(":")[0];
      const account = await resolveAccount(adapterName, message);

      if (account.onboardingState !== "complete") {
        await handleOnboarding(account, message.text, (text: string) => thread.post(text));
        await thread.subscribe();
        return;
      }

      await thread.subscribe();
      await thread.startTyping();
      await handleAiMessage(thread, message, account.userId);
    } catch (error) {
      console.error("[NutriBalance Bot] Error handling message:", error);
      try {
        await thread.post("Sorry, something went wrong. Please try again.");
      } catch {
        console.error("[NutriBalance Bot] Failed to send error message");
      }
    }
  });

  // Handle follow-up messages in subscribed threads
  bot.onSubscribedMessage(async (thread, message) => {
    try {
      const adapterName = thread.id.split(":")[0];
      const account = await resolveAccount(adapterName, message);

      if (account.onboardingState !== "complete") {
        await handleOnboarding(account, message.text, (text: string) => thread.post(text));
        return;
      }

      await thread.startTyping();
      await handleAiMessage(thread, message, account.userId);
    } catch (error) {
      console.error("[NutriBalance Bot] Error handling message:", error);
      try {
        await thread.post("Sorry, something went wrong. Please try again.");
      } catch {
        console.error("[NutriBalance Bot] Failed to send error message");
      }
    }
  });
}
