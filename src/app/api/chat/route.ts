import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { getSession } from "@/lib/auth-session";
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

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = session.user;

  const { messages: uiMessages } = await req.json();
  const messages = await convertToModelMessages(uiMessages);

  const toolCtx: ToolContext = { userId: user.id };

  // Fetch user profile for context
  const [profile] = await db
    .select({ displayName: profiles.displayName, clinicalNotes: profiles.clinicalNotes })
    .from(profiles)
    .where(eq(profiles.id, user.id));

  // Fetch user nutrient limits for context
  const userLimits = await db
    .select({
      nutrient_id: userNutrientLimits.nutrientId,
      daily_limit: userNutrientLimits.dailyLimit,
      mode: userNutrientLimits.mode,
      range_min: userNutrientLimits.rangeMin,
      range_max: userNutrientLimits.rangeMax,
    })
    .from(userNutrientLimits)
    .where(eq(userNutrientLimits.userId, user.id));

  const limitNutrientIds = userLimits.map((l) => l.nutrient_id);
  let limitsContext = "";
  if (limitNutrientIds.length > 0) {
    const nutrientRows = await db
      .select({ id: nutrients.id, displayName: nutrients.displayName, unit: nutrients.unit })
      .from(nutrients)
      .where(inArray(nutrients.id, limitNutrientIds));
    const nutrientMap = new Map(nutrientRows.map((n) => [n.id, n]));

    limitsContext = (userLimits ?? [])
      .map((l: { nutrient_id: string; daily_limit: string; mode: string }) => {
        const n = nutrientMap.get(l.nutrient_id);
        if (!n) return null;
        return `- ${n.displayName}: ${l.daily_limit} ${n.unit}/day (${l.mode} mode)`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const systemPrompt = `You are NutriBalance Assistant, a specialized nutrition agent for ${profile?.displayName ?? "the user"}.

IMPORTANT PRIVACY RULES:
- You ONLY discuss this specific user's dietary data, limits, and food logs. Never reference other users.
- All data you access is private to this user, protected by row-level security.
- If asked about other people's diets, politely decline.

YOUR CAPABILITIES:
- Search for foods in the database and check their nutrient content
- Check if the user can safely eat a specific food today (based on their daily limits and what they've already eaten)
- Record meals / log food consumption
- Provide the user's current daily nutrient summary
- Research foods not in the database using AI and return usable nutrient data in the same reply

USER'S NUTRIENT LIMITS:
${limitsContext || "No limits configured yet. Suggest they set up limits in Settings."}

${profile?.clinicalNotes ? `CLINICAL NOTES:\n${profile.clinicalNotes}` : ""}

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

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      searchFood: {
        description:
          "Search for a food in the database by name. Returns matching foods with their variants and nutrient data.",
        inputSchema: z.object({
          query: z.string().describe("The food name to search for"),
        }),
        execute: async (params) => searchFood(params, toolCtx),
      },

      getFoodNutrients: {
        description:
          "Get the full nutrient breakdown for a specific food variant. Use after searchFood to get detailed nutrient data.",
        inputSchema: z.object({
          foodVariantId: z.string().describe("The food variant ID to get nutrients for"),
        }),
        execute: async (params) => getFoodNutrients(params, toolCtx),
      },

      checkCanIEat: {
        description:
          "Check if the user can safely eat a specific food today based on their daily nutrient limits and what they've already consumed. Shows impact analysis.",
        inputSchema: z.object({
          foodVariantId: z.string().describe("The food variant ID"),
          portionGrams: z.number().describe("How many grams the user wants to eat"),
        }),
        execute: async (params) => checkCanIEat(params, toolCtx),
      },

      recordMeal: {
        description:
          "Log a food consumption entry for the user. Records what they ate with nutrient snapshot for tracking. Do NOT invent a servingMeasureId — only pass one if you got it from searchFood results. Otherwise omit it.",
        inputSchema: z.object({
          foodVariantId: z.string().describe("The food variant ID from searchFood results"),
          servingMeasureId: z
            .string()
            .optional()
            .describe(
              "The serving measure ID from searchFood results. Omit if not available — the system will log by grams instead.",
            ),
          quantity: z.number().positive().describe("Number of servings (or 1 if logging by grams)"),
          portionGrams: z.number().positive().describe("Total grams being consumed"),
          mealLabel: z
            .string()
            .optional()
            .describe("Optional meal label: breakfast, lunch, dinner, snack"),
        }),
        execute: async (params) => recordMeal(params, toolCtx),
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
        execute: async (params) => aiResearchFood(params, toolCtx),
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
