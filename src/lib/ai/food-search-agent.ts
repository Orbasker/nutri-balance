"use server";

import { Output, generateText } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { finishAiRun, startAiRun } from "@/lib/ai-run-audit";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import {
  evidenceItems,
  nutrientObservations,
  sourceRecords,
  sources,
} from "@/lib/db/schema/observations";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { getLangfuse } from "@/lib/langfuse";
import { flushLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";

const AI_SOURCE_NAME = "NutriBalance AI Agent";

const VALID_PREP_METHODS = [
  "raw",
  "boiled",
  "steamed",
  "grilled",
  "baked",
  "fried",
  "roasted",
  "sauteed",
  "poached",
  "blanched",
  "drained",
] as const;

type PrepMethod = (typeof VALID_PREP_METHODS)[number];

export interface ResearchedFoodNutrient {
  displayName: string;
  unit: string;
  valuePer100g: number;
  confidence: number;
}

export interface ResearchedFoodVariantPreview {
  id: string;
  preparationMethod: PrepMethod;
  servings: Array<{ label: string; grams: number }>;
  nutrients: ResearchedFoodNutrient[];
}

export interface ResearchedFoodResult {
  foodId: string;
  foodName: string;
  variantsCount: number;
  defaultVariant: ResearchedFoodVariantPreview;
}

/**
 * Zod schema for the AI-generated food profile.
 * Using generateObject ensures type-safe structured output — no JSON parsing needed.
 */
const aiFoodSchema = z.object({
  name: z.string().describe("Canonical food name in English"),
  category: z
    .enum([
      "vegetable",
      "fruit",
      "protein",
      "grain",
      "dairy",
      "legume",
      "nut",
      "oil",
      "spice",
      "other",
    ])
    .describe("Food category"),
  description: z.string().describe("Brief description of the food"),
  commonServings: z
    .array(
      z.object({
        label: z.string().describe("Serving label, e.g. 'per cup (130g)'"),
        grams: z.number().positive().describe("Weight in grams"),
      }),
    )
    .min(1)
    .describe("Common serving measures, always include 'per 100g'"),
  variants: z
    .array(
      z.object({
        preparationMethod: z.enum(VALID_PREP_METHODS).describe("How the food is prepared"),
        isDefault: z.boolean().describe("Whether this is the most common preparation"),
        description: z.string().describe("Brief variant description"),
        nutrients: z.array(
          z.object({
            nutrientName: z.string().describe("Internal nutrient name"),
            valuePer100g: z.number().nonnegative().describe("Amount per 100g"),
            confidence: z.number().min(0).max(100).describe("Confidence 0-100"),
            reasoning: z.string().describe("Data source or reasoning"),
          }),
        ),
      }),
    )
    .min(1)
    .describe("Preparation variants with nutrient data"),
});

/**
 * Get or create the AI agent source record.
 */
async function getOrCreateAiSource(): Promise<string> {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.name, AI_SOURCE_NAME))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(sources)
    .values({
      name: AI_SOURCE_NAME,
      type: "ai_generated",
      trustLevel: 30,
    })
    .returning({ id: sources.id });

  return created.id;
}

/**
 * AI-powered food search agent. When a user searches for a food not in the DB,
 * this agent researches it via LLM, persists the results as pending observations,
 * and returns a food ID the user can immediately view.
 */
export async function aiResearchFood(
  query: string,
  userId: string,
  options?: {
    source?: string;
  },
): Promise<ResearchedFoodResult | { error: string }> {
  const allNutrients = await db.select().from(nutrients).orderBy(nutrients.sortOrder);

  if (allNutrients.length === 0) {
    return { error: "No nutrients configured in the system." };
  }

  const nutrientList = allNutrients.map((n) => `${n.displayName} (${n.unit})`).join(", ");
  const nutrientNames = allNutrients.map((n) => n.name).join(", ");

  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "food-search-agent",
    userId,
    metadata: { query, source: options?.source ?? "app-search" },
  });
  const aiRun = await startAiRun({
    type: "food_generation",
    goal: `Research food "${query}"`,
    source: options?.source ?? "app-search",
    triggerUserId: userId,
    metadata: {
      query,
    },
  });

  try {
    const model = getModel();

    const modelName = typeof model === "string" ? model : model.modelId;

    const generation = trace.generation({
      name: "generate-food-profile",
      model: modelName,
      input: { query, nutrients: nutrientNames },
    });

    const { output: foodData, usage } = await generateText({
      model,
      output: Output.object({ schema: aiFoodSchema }),
      prompt: `Research the full nutrient profile for: "${query}"

Provide nutrient values for ALL of these nutrients: ${nutrientList}
Use nutrient names exactly as: ${nutrientNames}

Rules:
- Always include a "raw" variant as the primary form
- Add 1-2 common cooked variants where applicable (e.g., boiled, steamed, grilled)
- Confidence: 85-95 for well-known foods (USDA data), 60-80 for estimates, <60 for uncertain
- Always include "per 100g" as first serving. Add 1-2 practical measures (per cup, per piece, etc.)
- Base values on USDA FoodData Central, NCCDB, or established nutrition literature`,
    });

    generation.end({
      output: foodData,
      usage: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
      },
    });

    await recordAiUsageEvent({
      feature: "food-search",
      operation: "generate-food-profile",
      model: modelName,
      userId,
      aiRunId: aiRun.id,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      metadata: {
        query,
      },
    });

    // Validate that we got useful data
    if (!foodData || !foodData.name || !foodData.variants?.length) {
      await finishAiRun(aiRun, {
        status: "failed",
        resultSummary: "AI could not identify a valid food profile.",
        errorMessage: "AI could not identify this food.",
        metadata: {
          query,
        },
      });
      return { error: "AI could not identify this food. Try a more specific name." };
    }

    // Persist the food, variants, nutrients, and observations
    const sourceId = await getOrCreateAiSource();
    let observationCount = 0;

    const [food] = await db
      .insert(foods)
      .values({
        name: foodData.name,
        category: foodData.category || null,
        description: foodData.description || null,
      })
      .returning({ id: foods.id });

    const nutrientMap = new Map(allNutrients.map((n) => [n.name, n]));

    const createdVariants: ResearchedFoodVariantPreview[] = [];

    for (const variant of foodData.variants) {
      const prepMethod: PrepMethod = VALID_PREP_METHODS.includes(variant.preparationMethod)
        ? variant.preparationMethod
        : "raw";

      const [fv] = await db
        .insert(foodVariants)
        .values({
          foodId: food.id,
          preparationMethod: prepMethod,
          description: variant.description || null,
          isDefault: variant.isDefault ?? false,
        })
        .returning({ id: foodVariants.id });

      // Add serving measures
      const servings = foodData.commonServings?.length
        ? foodData.commonServings
        : [{ label: "per 100g", grams: 100 }];
      const variantServings = servings.map((serving) => ({
        label: serving.label,
        grams: serving.grams,
      }));

      for (const serving of servings) {
        await db.insert(servingMeasures).values({
          foodVariantId: fv.id,
          label: serving.label,
          gramsEquivalent: String(serving.grams),
        });
      }

      const previewNutrients: ResearchedFoodNutrient[] = [];

      // Create nutrient observations + resolved values
      for (const nutrientData of variant.nutrients) {
        const nutrient = nutrientMap.get(nutrientData.nutrientName);
        if (!nutrient) continue;

        previewNutrients.push({
          displayName: nutrient.displayName,
          unit: nutrient.unit,
          valuePer100g: nutrientData.valuePer100g,
          confidence: Math.min(nutrientData.confidence, 80),
        });

        const [record] = await db
          .insert(sourceRecords)
          .values({ sourceId, rawData: nutrientData })
          .returning({ id: sourceRecords.id });

        const [observation] = await db
          .insert(nutrientObservations)
          .values({
            foodVariantId: fv.id,
            nutrientId: nutrient.id,
            value: String(nutrientData.valuePer100g),
            unit: nutrient.unit,
            basisAmount: "100",
            basisUnit: "g",
            sourceRecordId: record.id,
            derivationType: "ai_extracted",
            confidenceScore: Math.min(nutrientData.confidence, 80),
            reviewStatus: "pending",
          })
          .returning({ id: nutrientObservations.id });

        await db.insert(evidenceItems).values({
          observationId: observation.id,
          snippet: nutrientData.reasoning,
        });
        observationCount++;

        const confidenceLabel =
          nutrientData.confidence >= 80
            ? "Good confidence"
            : nutrientData.confidence >= 60
              ? "Moderate"
              : "Low";

        await db.insert(resolvedNutrientValues).values({
          foodVariantId: fv.id,
          nutrientId: nutrient.id,
          valuePer100g: String(nutrientData.valuePer100g),
          confidenceScore: Math.min(nutrientData.confidence, 80),
          confidenceLabel,
          sourceSummary: `AI-generated: ${nutrientData.reasoning}`,
        });
      }

      createdVariants.push({
        id: fv.id,
        preparationMethod: prepMethod,
        servings: variantServings,
        nutrients: previewNutrients,
      });
    }

    await finishAiRun(aiRun, {
      status: "completed",
      itemCount: observationCount,
      foodId: food.id,
      resultSummary: `Created ${foodData.name} with ${foodData.variants.length} variants and ${observationCount} AI observations.`,
      metadata: {
        query,
        foodName: foodData.name,
        variantCount: foodData.variants.length,
      },
    });

    trace.update({ output: { foodId: food.id, name: foodData.name } });
    await flushLangfuse();

    const defaultVariant =
      createdVariants[foodData.variants.findIndex((variant) => variant.isDefault)] ??
      createdVariants[0];

    if (!defaultVariant) {
      return { error: "Research completed but no usable variant data was saved." };
    }

    return {
      foodId: food.id,
      foodName: foodData.name,
      variantsCount: createdVariants.length,
      defaultVariant,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await finishAiRun(aiRun, {
      status: "failed",
      errorMessage,
      resultSummary: "Food generation failed.",
      metadata: {
        query,
      },
    });

    trace.update({
      output: { error: errorMessage },
    });
    await flushLangfuse();
    console.error("AI food search error:", error);
    return { error: "Failed to research food. Please try again." };
  }
}
