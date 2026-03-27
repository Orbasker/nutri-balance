import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { and, eq, gte, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { getSession } from "@/lib/auth-session";
import { calculateNutrientAmount, getConfidenceLabel, getNutrientStatus } from "@/lib/calculations";
import { db } from "@/lib/db";
import { foodAliases, foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { consumptionLogs, profiles, userNutrientLimits } from "@/lib/db/schema/users";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = session.user;

  const { messages: uiMessages } = await req.json();
  const messages = await convertToModelMessages(uiMessages);

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
- Research foods not in the database using AI (triggers background research)

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
        execute: async ({ query }) => {
          const searchTerm = `%${query}%`;
          const matchingFoods = await db
            .select({
              foodId: foods.id,
              foodName: foods.name,
              category: foods.category,
              variantId: foodVariants.id,
              preparationMethod: foodVariants.preparationMethod,
              isDefault: foodVariants.isDefault,
              servingId: servingMeasures.id,
              servingLabel: servingMeasures.label,
              gramsEquivalent: servingMeasures.gramsEquivalent,
            })
            .from(foods)
            .leftJoin(foodAliases, eq(foodAliases.foodId, foods.id))
            .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
            .leftJoin(servingMeasures, eq(servingMeasures.foodVariantId, foodVariants.id))
            .where(or(ilike(foods.name, searchTerm), ilike(foodAliases.alias, searchTerm)))
            .limit(30);

          if (matchingFoods.length === 0) {
            return { found: false, message: `No foods found matching "${query}".` };
          }

          // Group by food
          const foodMap = new Map<
            string,
            {
              id: string;
              name: string;
              category: string | null;
              variants: Map<
                string,
                {
                  id: string;
                  method: string;
                  isDefault: boolean;
                  servings: Array<{ id: string; label: string; grams: number }>;
                }
              >;
            }
          >();

          for (const row of matchingFoods) {
            if (!foodMap.has(row.foodId)) {
              foodMap.set(row.foodId, {
                id: row.foodId,
                name: row.foodName,
                category: row.category,
                variants: new Map(),
              });
            }
            const food = foodMap.get(row.foodId)!;

            if (row.variantId && !food.variants.has(row.variantId)) {
              food.variants.set(row.variantId, {
                id: row.variantId,
                method: row.preparationMethod ?? "raw",
                isDefault: row.isDefault ?? false,
                servings: [],
              });
            }
            if (row.variantId && row.servingId) {
              const variant = food.variants.get(row.variantId)!;
              if (!variant.servings.some((s) => s.id === row.servingId)) {
                variant.servings.push({
                  id: row.servingId!,
                  label: row.servingLabel!,
                  grams: Number(row.gramsEquivalent),
                });
              }
            }
          }

          return {
            found: true,
            foods: Array.from(foodMap.values()).map((f) => ({
              id: f.id,
              name: f.name,
              category: f.category,
              variants: Array.from(f.variants.values()).map((v) => ({
                id: v.id,
                preparationMethod: v.method,
                isDefault: v.isDefault,
                servings: v.servings,
              })),
            })),
          };
        },
      },

      getFoodNutrients: {
        description:
          "Get the full nutrient breakdown for a specific food variant. Use after searchFood to get detailed nutrient data.",
        inputSchema: z.object({
          foodVariantId: z.string().describe("The food variant ID to get nutrients for"),
        }),
        execute: async ({ foodVariantId }) => {
          const rows = await db
            .select({
              nutrientId: resolvedNutrientValues.nutrientId,
              valuePer100g: resolvedNutrientValues.valuePer100g,
              confidenceScore: resolvedNutrientValues.confidenceScore,
              displayName: nutrients.displayName,
              unit: nutrients.unit,
            })
            .from(resolvedNutrientValues)
            .innerJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
            .where(eq(resolvedNutrientValues.foodVariantId, foodVariantId))
            .orderBy(nutrients.sortOrder);

          return {
            nutrients: rows.map((r) => ({
              nutrientId: r.nutrientId,
              displayName: r.displayName,
              unit: r.unit,
              valuePer100g: Number(r.valuePer100g),
              confidenceScore: r.confidenceScore,
              confidenceLabel: getConfidenceLabel(r.confidenceScore ?? 50),
            })),
          };
        },
      },

      checkCanIEat: {
        description:
          "Check if the user can safely eat a specific food today based on their daily nutrient limits and what they've already consumed. Shows impact analysis.",
        inputSchema: z.object({
          foodVariantId: z.string().describe("The food variant ID"),
          portionGrams: z.number().describe("How many grams the user wants to eat"),
        }),
        execute: async ({ foodVariantId, portionGrams }) => {
          // Get today's consumption
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const logs = await db
            .select({ nutrientSnapshot: consumptionLogs.nutrientSnapshot })
            .from(consumptionLogs)
            .where(and(eq(consumptionLogs.userId, user.id), gte(consumptionLogs.loggedAt, today)));

          const todayTotals: Record<string, number> = {};
          for (const log of logs) {
            const snap = log.nutrientSnapshot as Record<string, number> | null;
            if (!snap) continue;
            for (const [nId, amt] of Object.entries(snap)) {
              todayTotals[nId] = (todayTotals[nId] ?? 0) + amt;
            }
          }

          // Get nutrient values for this variant
          const nutrientRows = await db
            .select({
              nutrientId: resolvedNutrientValues.nutrientId,
              valuePer100g: resolvedNutrientValues.valuePer100g,
              displayName: nutrients.displayName,
              unit: nutrients.unit,
            })
            .from(resolvedNutrientValues)
            .innerJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
            .where(eq(resolvedNutrientValues.foodVariantId, foodVariantId))
            .orderBy(nutrients.sortOrder);

          // Get variant + food name
          const [variantInfo] = await db
            .select({ foodName: foods.name, method: foodVariants.preparationMethod })
            .from(foodVariants)
            .innerJoin(foods, eq(foods.id, foodVariants.foodId))
            .where(eq(foodVariants.id, foodVariantId));

          const limitsMap = new Map(
            (userLimits ?? []).map(
              (l: { nutrient_id: string; daily_limit: string; mode: string }) => [
                l.nutrient_id,
                { dailyLimit: Number(l.daily_limit), mode: l.mode },
              ],
            ),
          );

          const impact = nutrientRows.map((n) => {
            const added = calculateNutrientAmount(Number(n.valuePer100g), portionGrams);
            const consumed = todayTotals[n.nutrientId] ?? 0;
            const newTotal = consumed + added;
            const limit = limitsMap.get(n.nutrientId);
            const status = getNutrientStatus(newTotal, limit?.dailyLimit ?? null);
            const pct = limit ? Math.round((newTotal / limit.dailyLimit) * 100) : null;

            return {
              nutrient: n.displayName,
              unit: n.unit,
              consumedToday: Math.round(consumed * 10) / 10,
              adding: Math.round(added * 10) / 10,
              newTotal: Math.round(newTotal * 10) / 10,
              dailyLimit: limit?.dailyLimit ?? null,
              percentOfLimit: pct,
              status,
            };
          });

          // Filter to only tracked nutrients (ones with limits) for the summary
          const trackedImpact = impact.filter((i) => i.dailyLimit !== null);
          const hasExceed = trackedImpact.some((i) => i.status === "exceed");
          const hasCaution = trackedImpact.some((i) => i.status === "caution");

          return {
            food: variantInfo?.foodName ?? "Unknown",
            preparationMethod: variantInfo?.method ?? "raw",
            portionGrams,
            overallVerdict: hasExceed ? "exceed" : hasCaution ? "caution" : "safe",
            trackedNutrients: trackedImpact,
            allNutrients: impact,
          };
        },
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
        execute: async ({ foodVariantId, servingMeasureId, quantity, portionGrams, mealLabel }) => {
          // Calculate nutrient snapshot
          const nutrientRows = await db
            .select({
              nutrientId: resolvedNutrientValues.nutrientId,
              valuePer100g: resolvedNutrientValues.valuePer100g,
            })
            .from(resolvedNutrientValues)
            .where(eq(resolvedNutrientValues.foodVariantId, foodVariantId));

          const snapshot: Record<string, number> = {};
          for (const row of nutrientRows) {
            snapshot[row.nutrientId] = calculateNutrientAmount(
              Number(row.valuePer100g),
              portionGrams,
            );
          }

          await db.insert(consumptionLogs).values({
            userId: user.id,
            foodVariantId,
            servingMeasureId: servingMeasureId ?? null,
            quantity: String(quantity),
            nutrientSnapshot: snapshot,
            mealLabel: mealLabel ?? null,
          });

          // Get food name for confirmation
          const [variantInfo] = await db
            .select({ foodName: foods.name, method: foodVariants.preparationMethod })
            .from(foodVariants)
            .innerJoin(foods, eq(foods.id, foodVariants.foodId))
            .where(eq(foodVariants.id, foodVariantId));

          return {
            success: true,
            logged: {
              food: variantInfo?.foodName ?? "Unknown",
              preparationMethod: variantInfo?.method,
              quantity,
              portionGrams,
              mealLabel: mealLabel ?? null,
              nutrientCount: Object.keys(snapshot).length,
            },
          };
        },
      },

      getDailySummary: {
        description:
          "Get the user's nutrient intake summary for today. Shows consumed amounts vs daily limits.",
        inputSchema: z.object({}),
        execute: async () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const logs = await db
            .select({ nutrientSnapshot: consumptionLogs.nutrientSnapshot })
            .from(consumptionLogs)
            .where(and(eq(consumptionLogs.userId, user.id), gte(consumptionLogs.loggedAt, today)))
            .orderBy(consumptionLogs.loggedAt);

          const totals: Record<string, number> = {};
          for (const log of logs) {
            const snap = log.nutrientSnapshot as Record<string, number> | null;
            if (!snap) continue;
            for (const [nId, amt] of Object.entries(snap)) {
              totals[nId] = (totals[nId] ?? 0) + amt;
            }
          }

          if (limitNutrientIds.length === 0) {
            return {
              mealCount: logs.length,
              trackedNutrients: [],
              message: "No nutrient limits configured.",
            };
          }

          const nutrientRows = await db
            .select({ id: nutrients.id, displayName: nutrients.displayName, unit: nutrients.unit })
            .from(nutrients)
            .where(inArray(nutrients.id, limitNutrientIds))
            .orderBy(nutrients.sortOrder);

          const limitsMap = new Map(
            (userLimits ?? []).map(
              (l: { nutrient_id: string; daily_limit: string; mode: string }) => [
                l.nutrient_id,
                { dailyLimit: Number(l.daily_limit), mode: l.mode },
              ],
            ),
          );

          const summary = nutrientRows.map((n) => {
            const total = totals[n.id] ?? 0;
            const limit = limitsMap.get(n.id);
            const pct = limit ? Math.round((total / limit.dailyLimit) * 100) : null;
            return {
              nutrient: n.displayName,
              unit: n.unit,
              consumed: Math.round(total * 10) / 10,
              dailyLimit: limit?.dailyLimit ?? null,
              percentOfLimit: pct,
              status: getNutrientStatus(total, limit?.dailyLimit ?? null),
            };
          });

          return {
            mealCount: logs.length,
            trackedNutrients: summary,
          };
        },
      },

      aiResearchFood: {
        description:
          "Research a food not found in the database using AI. This triggers a background research process that creates the food with AI-generated nutrient estimates.",
        inputSchema: z.object({
          foodName: z.string().describe("The name of the food to research"),
        }),
        execute: async ({ foodName }) => {
          const { aiResearchFood } = await import("@/lib/ai/food-search-agent");
          const result = await aiResearchFood(foodName, user.id);

          if ("error" in result) {
            return { success: false, error: result.error };
          }

          return {
            success: true,
            foodId: result.foodId,
            message: `Successfully researched and added "${foodName}" to the database. You can now search for it.`,
          };
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
