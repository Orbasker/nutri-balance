"use server";

import { Output, generateText } from "ai";
import { eq, notInArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import {
  evidenceItems,
  sourceRecords,
  sources,
  substanceObservations,
} from "@/lib/db/schema/observations";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";

const AI_SOURCE_NAME = "NutriBalance AI Enricher";

const enrichResultSchema = z.object({
  nutrients: z.array(
    z.object({
      substanceName: z.string(),
      valuePer100g: z.number().nonnegative(),
      unit: z.string(),
      confidence: z.number().min(0).max(100),
      reasoning: z.string(),
    }),
  ),
});

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
 * Enrich a food variant with AI-researched nutritional data for all missing substances.
 */
export async function enrichFoodVariant(
  foodId: string,
  foodVariantId: string,
  _userId: string,
): Promise<{ ok: true; enriched: number } | { error: string }> {
  // Get the food and variant info
  const [food] = await db.select({ name: foods.name }).from(foods).where(eq(foods.id, foodId));
  if (!food) return { error: "Food not found." };

  const [variant] = await db
    .select({ preparationMethod: foodVariants.preparationMethod })
    .from(foodVariants)
    .where(eq(foodVariants.id, foodVariantId));
  if (!variant) return { error: "Variant not found." };

  // Find substances that already have resolved values for this variant
  const existingSubstanceIds = db
    .select({ substanceId: resolvedSubstanceValues.substanceId })
    .from(resolvedSubstanceValues)
    .where(eq(resolvedSubstanceValues.foodVariantId, foodVariantId));

  // Get all missing substances
  const missingSubstances = await db
    .select({
      id: substances.id,
      name: substances.name,
      displayName: substances.displayName,
      unit: substances.unit,
      category: substances.category,
    })
    .from(substances)
    .where(notInArray(substances.id, existingSubstanceIds));

  if (missingSubstances.length === 0) {
    return { ok: true, enriched: 0 };
  }

  const substanceList = missingSubstances
    .map((s) => `- ${s.displayName} (${s.name}, unit: ${s.unit})`)
    .join("\n");

  const model = getModel();

  const { output: object } = await generateText({
    model,
    output: Output.object({ schema: enrichResultSchema }),
    prompt: `You are a nutrition data researcher. Estimate the nutritional content per 100g for:

Food: ${food.name} (${variant.preparationMethod})

Provide values for these nutrients:
${substanceList}

Rules:
- Use the exact substanceName from the list above
- Values must be per 100g of edible portion
- Confidence: 85-95 for well-established USDA/NCCDB data, 60-80 for reasonable estimates, <60 for uncertain
- If a nutrient is truly not present (e.g., cholesterol in a plant food), use valuePer100g: 0 and confidence: 90
- If you cannot estimate at all, use valuePer100g: 0 and confidence: 10
- Base values on USDA FoodData Central, NCCDB, or established nutrition literature
- Include brief reasoning citing the source basis`,
  });

  if (!object) {
    return { error: "AI did not return structured output." };
  }

  const sourceId = await getOrCreateAiSource();
  let enriched = 0;

  // Map substance names to IDs
  const nameToSubstance = new Map(missingSubstances.map((s) => [s.name, s]));

  for (const result of object.nutrients) {
    const substance = nameToSubstance.get(result.substanceName);
    if (!substance) continue;
    // Skip very low confidence or zero-value with low confidence
    if (result.confidence < 15) continue;

    const [record] = await db
      .insert(sourceRecords)
      .values({ sourceId, rawData: result })
      .returning({ id: sourceRecords.id });

    const [observation] = await db
      .insert(substanceObservations)
      .values({
        foodVariantId,
        substanceId: substance.id,
        value: String(result.valuePer100g),
        unit: result.unit,
        basisAmount: "100",
        basisUnit: "g",
        sourceRecordId: record.id,
        derivationType: "ai_extracted",
        confidenceScore: result.confidence,
        reviewStatus: "pending",
      })
      .returning({ id: substanceObservations.id });

    await db.insert(evidenceItems).values({
      observationId: observation.id,
      snippet: result.reasoning,
    });

    // Also insert as resolved value so it shows up immediately
    await db.insert(resolvedSubstanceValues).values({
      foodVariantId,
      substanceId: substance.id,
      valuePer100g: String(result.valuePer100g),
      confidenceScore: result.confidence,
      confidenceLabel:
        result.confidence >= 90
          ? "High confidence"
          : result.confidence >= 80
            ? "Good confidence"
            : result.confidence >= 60
              ? "Moderate confidence"
              : "Low confidence",
      sourceSummary: "AI-researched (pending review)",
    });

    enriched++;
  }

  return { ok: true, enriched };
}
