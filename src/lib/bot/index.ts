import { createDiscordAdapter } from "@chat-adapter/discord";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { stepCountIs, streamText } from "ai";
import { Chat, toAiMessages } from "chat";
import { and, eq, inArray } from "drizzle-orm";
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
import { user } from "@/lib/db/schema/auth";
import { nutrients } from "@/lib/db/schema/nutrients";
import { profiles, userNutrientLimits } from "@/lib/db/schema/users";

import { generateLinkUrl } from "./account-link";
import {
  buildClarifyResearchReply,
  buildRequestFailureReply,
  buildResearchOutcomeReply,
  buildToolOnlyReply,
  containsHebrew,
  extractFoodResearchRequest,
  findMostRecentResearchFood,
  hasRecentResearchContext,
  isResearchConfirmation,
} from "./message-recovery";
import { findOrCreatePlatformAccount } from "./user-linking";
import { getWebLinksBlock } from "./web-links";

let _bot: Chat | null = null;

function getToolErrorDetails(result: unknown): unknown | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  if ("success" in result && result.success === false) {
    return result;
  }

  if ("output" in result && result.output && typeof result.output === "object") {
    const output = result.output as Record<string, unknown>;
    if ("success" in output && output.success === false) {
      return output;
    }
  }

  return null;
}

async function getAccountLinkStatus(userId: string): Promise<{ isLinked: boolean }> {
  const [authUser] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));

  return {
    isLinked: authUser?.email ? !authUser.email.endsWith("@bot.nutribalance.local") : false,
  };
}

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
    onLockConflict: "force",
  });

  // Register handlers on the freshly-created instance
  registerHandlers(_bot);

  return _bot;
}

/**
 * Build the system prompt for the AI. Adapts dynamically based on what user
 * data is actually present in the database — no onboarding state to track.
 */
async function buildSystemPrompt(userId: string, isLinked: boolean): Promise<string> {
  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      clinicalNotes: profiles.clinicalNotes,
      healthGoal: profiles.healthGoal,
    })
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

  // Detect what's missing and build setup guidance dynamically
  const missing: string[] = [];
  if (!profile?.displayName || profile.displayName === "Bot User") missing.push("name");
  if (!profile?.healthGoal) missing.push("health goal or dietary concern");
  if (userLimits.length === 0) missing.push("nutrient limits");

  const accountLinkBlock = !isLinked
    ? `\nACCOUNT LINKING:
This user's bot account is NOT linked to a NutriBalance web account. After initial setup is complete (name + at least one nutrient limit), mention once that they can link their account to access the web dashboard, view detailed charts, and sync their data across devices. Use the linkWebAccount tool to generate a personal link. Don't push it repeatedly — one friendly mention is enough.
If the user asks whether their account is linked, tell them it is NOT linked yet and offer to generate a link.
`
    : `\nACCOUNT LINKING:
This user's bot account IS linked to a NutriBalance web account. Their data syncs between the bot and web dashboard.
If the user asks whether their account is linked, confirm it is already linked and syncing automatically.
If they ask to reconnect, disconnect, or connect again, explain there is usually no need because sync is already active.
If they want to connect this bot to a DIFFERENT web account, offer to generate a fresh link with the linkWebAccount tool.
When helpful, include the Daily log and Dashboard links.
`;

  const setupBlock =
    missing.length > 0
      ? `\nSETUP NEEDED:
This user still needs: ${missing.join(", ")}.
${missing.includes("name") ? "- Ask their name and save with updateProfile." : ""}
${missing.includes("health goal or dietary concern") ? "- Ask about their health goal / dietary concern and save with updateProfile." : ""}
${missing.includes("nutrient limits") ? "- Help them set at least one nutrient limit. Use listAvailableNutrients to find IDs, then setNutrientLimit." : ""}

Be conversational and natural. If the user provides multiple pieces of info in one message (e.g. "I'm Or, I take blood thinners and need to keep Vitamin K under 10mcg"), extract ALL of it and call the relevant tools in one go. Don't force them through rigid steps — adapt to what they give you.
`
      : `\nRETURNING USER:
This user's profile is fully set up${isLinked ? " and their account is linked" : ""}. Do NOT ask onboarding questions (name, health goals, or what nutrients to track) — you already have all of this information in context.
When they greet you or say hi, respond warmly by name and offer to help with something specific — like checking if they can eat something, logging a meal, or reviewing their daily summary. Be proactive: if they have nutrient limits configured, you can mention you're ready to help them track today's intake.
`;

  // Build a user profile summary so the AI knows who it's talking to
  const profileLines: string[] = [];
  if (profile?.displayName && profile.displayName !== "Bot User") {
    profileLines.push(`- Name: ${profile.displayName}`);
  }
  if (profile?.healthGoal) {
    profileLines.push(`- Health goal: ${profile.healthGoal}`);
  }
  if (profile?.clinicalNotes) {
    profileLines.push(`- Clinical notes: ${profile.clinicalNotes}`);
  }
  if (isLinked) {
    profileLines.push("- Account: linked to web dashboard (data syncs automatically)");
  }

  const profileBlock = profileLines.length > 0 ? `\nUSER PROFILE:\n${profileLines.join("\n")}` : "";

  return `You are NutriBalance Assistant, a specialized nutrition agent for ${profile?.displayName ?? "the user"}.

IMPORTANT PRIVACY RULES:
- You ONLY discuss this specific user's dietary data, limits, and food logs. Never reference other users.
- All data you access is private to this user, protected by row-level security.
- If asked about other people's diets, politely decline.
${profileBlock}
${setupBlock}${accountLinkBlock}
YOUR CAPABILITIES:
- Search for foods in the database and check their nutrient content
- Check if the user can safely eat a specific food today (based on their daily limits and what they've already eaten)
- Record meals / log food consumption
- Provide the user's current daily nutrient summary
- Research foods not in the database using AI and return usable nutrient data in the same reply
- Update the user's profile (name, health goal) and nutrient limits
- Link this bot account to a NutriBalance web account (use linkWebAccount)

USER'S NUTRIENT LIMITS:
${limitsContext || "No limits configured yet."}

${getWebLinksBlock()}

RESPONSE STYLE:
- CRITICAL: You MUST always write a text response after using tools. Never end your turn with only tool calls. Summarize what you found and answer the user's question in plain language.
- Be concise and direct. Use the user's name when greeting them.
- Never ask the user for information you already have in context (their name, health goal, nutrient limits). Reference it naturally instead.
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
 * Build all AI tool definitions — includes both nutrition tools and profile/onboarding tools.
 */
function buildTools(toolCtx: ToolContext) {
  const tools = {
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
        "Research a food not found in the database using AI. Returns the researched food and default-variant nutrient data so you can answer immediately in the same turn.",
      inputSchema: z.object({
        foodName: z.string().describe("The name of the food to research"),
      }),
      execute: async (params: { foodName: string }) => aiResearchFood(params, toolCtx),
    },

    // --- Profile & onboarding tools ---
    updateProfile: {
      description:
        "Update the user's profile. Use to set their display name, health goal, or clinical notes. Can set one or more fields at a time.",
      inputSchema: z.object({
        displayName: z.string().optional().describe("The user's name"),
        healthGoal: z.string().optional().describe("Short health goal label"),
        clinicalNotes: z
          .string()
          .optional()
          .describe("Detailed clinical context or dietary concerns"),
      }),
      execute: async (params: {
        displayName?: string;
        healthGoal?: string;
        clinicalNotes?: string;
      }) => {
        const updates: Record<string, string> = {};
        if (params.displayName) updates.displayName = params.displayName;
        if (params.healthGoal) updates.healthGoal = params.healthGoal;
        if (params.clinicalNotes) updates.clinicalNotes = params.clinicalNotes;

        if (Object.keys(updates).length > 0) {
          await db.update(profiles).set(updates).where(eq(profiles.id, toolCtx.userId));
        }
        return { success: true, updated: Object.keys(updates) };
      },
    },
    listAvailableNutrients: {
      description:
        "List all nutrients available for tracking. Returns nutrient IDs, names, and units. Use before setNutrientLimit to find the correct nutrient ID.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: nutrients.id,
            displayName: nutrients.displayName,
            unit: nutrients.unit,
          })
          .from(nutrients)
          .orderBy(nutrients.sortOrder);
        return { nutrients: rows };
      },
    },
    setNutrientLimit: {
      description:
        "Set a daily nutrient limit for the user. Use the nutrient ID from listAvailableNutrients. If a limit already exists for this nutrient, it will be updated.",
      inputSchema: z.object({
        nutrientId: z.string().describe("The nutrient UUID from listAvailableNutrients"),
        dailyLimit: z.number().positive().describe("The daily limit value in the nutrient's unit"),
        mode: z
          .enum(["strict", "stability"])
          .optional()
          .describe("Tracking mode: strict (hard cap) or stability (range). Defaults to strict."),
      }),
      execute: async (params: { nutrientId: string; dailyLimit: number; mode?: string }) => {
        const [existing] = await db
          .select({ id: userNutrientLimits.id })
          .from(userNutrientLimits)
          .where(
            and(
              eq(userNutrientLimits.userId, toolCtx.userId),
              eq(userNutrientLimits.nutrientId, params.nutrientId),
            ),
          );

        const mode = (params.mode as "strict" | "stability") ?? "strict";

        if (existing) {
          await db
            .update(userNutrientLimits)
            .set({ dailyLimit: String(params.dailyLimit), mode })
            .where(eq(userNutrientLimits.id, existing.id));
          return { success: true, action: "updated" };
        }

        await db.insert(userNutrientLimits).values({
          userId: toolCtx.userId,
          nutrientId: params.nutrientId,
          dailyLimit: String(params.dailyLimit),
          mode,
        });
        return { success: true, action: "created" };
      },
    },
  };

  return {
    ...tools,
    linkWebAccount: {
      description:
        "Generate a link for the user to connect their bot account with their NutriBalance web account. This lets them access the same data on both the bot and the web dashboard. The link expires in 15 minutes.",
      inputSchema: z.object({}),
      execute: async () => {
        const url = await generateLinkUrl(toolCtx.userId);
        return {
          success: true,
          url,
          message:
            "Link generated. The user should click it to sign in and connect their accounts.",
        };
      },
    },
  };
}

/**
 * Handle an AI-powered message.
 */
async function handleAiMessage(
  thread: Parameters<Parameters<Chat["onNewMention"]>[0]>[0],
  message: Parameters<Parameters<Chat["onNewMention"]>[0]>[1],
  userId: string,
) {
  const toolCtx: ToolContext = { userId };
  const { isLinked } = await getAccountLinkStatus(userId);
  const userText = typeof message.text === "string" ? message.text : "";
  const systemPrompt = await buildSystemPrompt(userId, isLinked);

  // Build conversation history from thread
  const messages = [];
  for await (const msg of thread.allMessages) {
    messages.push(msg);
  }

  if (await tryHandleDeterministicResearch(thread, message, messages, toolCtx)) {
    return;
  }

  const history = await toAiMessages(messages);
  let lastToolCall: unknown = null;
  let lastToolResult: unknown = null;

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: history,
    stopWhen: stepCountIs(5),
    tools: buildTools(toolCtx),
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        lastToolCall = toolCalls[toolCalls.length - 1];
        lastToolResult = toolResults?.[toolResults.length - 1] ?? null;

        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          const res = toolResults?.[i];
          const errorDetails = getToolErrorDetails(res);
          console.log(
            `[NutriBalance Bot] Tool: ${call.toolName}`,
            JSON.stringify({
              toolName: call.toolName,
              ...(errorDetails ? { error: errorDetails } : { ok: true }),
            }),
          );
        }
      }
    },
  });

  if (thread.id.startsWith("telegram:")) {
    const finalText = (await result.text).trim();
    const fallbackText =
      buildToolOnlyReply({
        userText,
        toolCall: lastToolCall,
        toolResult: lastToolResult,
      }) ?? buildRequestFailureReply(userText);

    await thread.post(finalText || fallbackText);
    return;
  }

  await thread.post(result.fullStream);
}

async function tryHandleDeterministicResearch(
  thread: Parameters<Parameters<Chat["onNewMention"]>[0]>[0],
  message: Parameters<Parameters<Chat["onNewMention"]>[0]>[1],
  messages: unknown[],
  toolCtx: ToolContext,
): Promise<boolean> {
  const userText = typeof message.text === "string" ? message.text : "";
  if (!userText.trim()) {
    return false;
  }

  const prefersHebrew = containsHebrew(userText);
  let foodName = extractFoodResearchRequest(userText);

  if (!foodName && isResearchConfirmation(userText)) {
    const previousMessages = messages.slice(0, -1);
    if (!hasRecentResearchContext(previousMessages)) {
      return false;
    }

    foodName = findMostRecentResearchFood(previousMessages);
    if (!foodName) {
      await thread.post(buildClarifyResearchReply(prefersHebrew));
      return true;
    }
  }

  if (!foodName) {
    return false;
  }

  const existing = await searchFood({ query: foodName }, toolCtx);
  if (
    "found" in existing &&
    existing.found &&
    Array.isArray(existing.foods) &&
    existing.foods.length > 0
  ) {
    const matchingFood = existing.foods[0];
    const defaultVariant =
      matchingFood.variants.find((variant) => variant.isDefault) ?? matchingFood.variants[0];

    if (!defaultVariant) {
      await thread.post(buildRequestFailureReply(userText));
      return true;
    }

    const nutrientsResult = await getFoodNutrients({ foodVariantId: defaultVariant.id }, toolCtx);
    await thread.post(
      buildResearchOutcomeReply(
        matchingFood.name,
        {
          success: true,
          defaultVariant: {
            preparationMethod: defaultVariant.preparationMethod,
            nutrients: nutrientsResult.nutrients,
          },
        },
        prefersHebrew,
      ),
    );
    return true;
  }

  const researchResult = await aiResearchFood({ foodName }, toolCtx);
  await thread.post(buildResearchOutcomeReply(foodName, researchResult, prefersHebrew));
  return true;
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
      await thread.startTyping();
      const account = await resolveAccount(adapterName, message);

      await thread.subscribe();
      await handleAiMessage(thread, message, account.userId);
    } catch (error) {
      console.error("[NutriBalance Bot] Error handling message:", error);
      try {
        await thread.post(
          buildRequestFailureReply(typeof message.text === "string" ? message.text : ""),
        );
      } catch {
        console.error("[NutriBalance Bot] Failed to send error message");
      }
    }
  });

  // Handle follow-up messages in subscribed threads
  bot.onSubscribedMessage(async (thread, message) => {
    try {
      const adapterName = thread.id.split(":")[0];
      await thread.startTyping();
      const account = await resolveAccount(adapterName, message);

      await handleAiMessage(thread, message, account.userId);
    } catch (error) {
      console.error("[NutriBalance Bot] Error handling message:", error);
      try {
        await thread.post(
          buildRequestFailureReply(typeof message.text === "string" ? message.text : ""),
        );
      } catch {
        console.error("[NutriBalance Bot] Failed to send error message");
      }
    }
  });
}
