"use server";

import { generateObject } from "ai";
import { and, count, countDistinct, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import {
  evidenceItems,
  nutrientObservations,
  sourceRecords,
  sources,
} from "@/lib/db/schema/observations";
import { flushLangfuse } from "@/lib/langfuse";
import { getLangfuse } from "@/lib/langfuse";

const AI_SOURCE_NAME = "NutriBalance AI Researcher";

const nutrientDataPointSchema = z.object({
  foodName: z.string(),
  preparationMethod: z.string(),
  valuePer100g: z.number().nonnegative(),
  unit: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

const batchResultSchema = z.object({
  results: z.array(nutrientDataPointSchema),
});

/**
 * Get or create the AI-generated source record.
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
 * Find food variants that are missing observations for a given nutrient.
 */
async function findMissingVariants(nutrientId: string) {
  const variantsWithData = db
    .select({ foodVariantId: nutrientObservations.foodVariantId })
    .from(nutrientObservations)
    .where(eq(nutrientObservations.nutrientId, nutrientId));

  return db
    .select({
      variantId: foodVariants.id,
      foodName: foods.name,
      preparationMethod: foodVariants.preparationMethod,
    })
    .from(foodVariants)
    .innerJoin(foods, eq(foodVariants.foodId, foods.id))
    .where(notInArray(foodVariants.id, variantsWithData));
}

/**
 * Call AI to research nutrient content for a batch of food variants.
 */
async function researchBatch(
  nutrientName: string,
  nutrientUnit: string,
  batch: { variantId: string; foodName: string; preparationMethod: string }[],
) {
  const foodList = batch.map((b) => `- ${b.foodName} (${b.preparationMethod})`).join("\n");
  const model = getModel();

  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "nutrient-research-batch",
    metadata: { nutrient: nutrientName, batchSize: batch.length },
  });

  const modelName = typeof model === "string" ? model : model.modelId;

  const generation = trace.generation({
    name: "research-batch",
    model: modelName,
    input: { nutrientName, foodList },
  });

  const { object, usage } = await generateObject({
    model,
    schema: batchResultSchema,
    prompt: `You are a nutrition data researcher. Estimate ${nutrientName} (${nutrientUnit}) content per 100g for these foods:
${foodList}

Rules:
- Use exact food names and preparation methods from the input
- Confidence: 85-95 for well-known USDA data, 60-80 for estimates, <60 for uncertain
- If you cannot estimate a value, use valuePer100g: 0 and confidence: 10
- Base values on USDA FoodData Central, NCCDB, or established nutrition literature`,
  });

  generation.end({
    output: object,
    usage: {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.totalTokens,
    },
  });

  return object.results;
}

/**
 * Process a single AI task: research a nutrient across all foods missing data.
 */
export async function processNutrientResearchTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(aiTasks).where(eq(aiTasks.id, taskId)).limit(1);
  if (!task || task.status !== "pending") return;

  await db
    .update(aiTasks)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(aiTasks.id, taskId));

  try {
    const [nutrient] = await db
      .select()
      .from(nutrients)
      .where(eq(nutrients.id, task.targetNutrientId))
      .limit(1);

    if (!nutrient) throw new Error("Nutrient not found");

    const missing = await findMissingVariants(nutrient.id);

    if (missing.length === 0) {
      await db
        .update(aiTasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          progress: { processed: 0, total: 0, errors: 0 },
          resultSummary: "No missing data found — all food variants already have observations.",
        })
        .where(eq(aiTasks.id, taskId));
      return;
    }

    const sourceId = await getOrCreateAiSource();
    let processed = 0;
    let errors = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);

      try {
        const results = await researchBatch(nutrient.name, nutrient.unit, batch);

        for (const result of results) {
          const variant = batch.find(
            (b) =>
              b.foodName === result.foodName && b.preparationMethod === result.preparationMethod,
          );
          if (!variant) continue;

          const [record] = await db
            .insert(sourceRecords)
            .values({ sourceId, rawData: result })
            .returning({ id: sourceRecords.id });

          const [observation] = await db
            .insert(nutrientObservations)
            .values({
              foodVariantId: variant.variantId,
              nutrientId: nutrient.id,
              value: String(result.valuePer100g),
              unit: result.unit,
              basisAmount: "100",
              basisUnit: "g",
              sourceRecordId: record.id,
              derivationType: "ai_extracted",
              confidenceScore: result.confidence,
              reviewStatus: "pending",
            })
            .returning({ id: nutrientObservations.id });

          await db.insert(evidenceItems).values({
            observationId: observation.id,
            snippet: result.reasoning,
          });

          processed++;
        }
      } catch {
        errors += batch.length;
      }

      await db
        .update(aiTasks)
        .set({ progress: { processed, total: missing.length, errors } })
        .where(eq(aiTasks.id, taskId));
    }

    await db
      .update(aiTasks)
      .set({
        status: "completed",
        completedAt: new Date(),
        progress: { processed, total: missing.length, errors },
        resultSummary: `Researched ${processed} food variants for ${nutrient.displayName}. ${errors} errors.`,
      })
      .where(eq(aiTasks.id, taskId));
  } catch (error) {
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(aiTasks.id, taskId));
  } finally {
    await flushLangfuse();
  }
}

/**
 * Find nutrient data gaps and create tasks to fill them.
 * Called by the daily scheduler.
 */
export async function findAndCreateGapTasks(): Promise<number> {
  const allNutrients = await db.select().from(nutrients);
  const totalVariants = await db.select({ count: count() }).from(foodVariants);
  const variantCount = totalVariants[0]?.count ?? 0;

  let tasksCreated = 0;

  for (const nutrient of allNutrients) {
    const [{ count: observedCount }] = await db
      .select({ count: countDistinct(nutrientObservations.foodVariantId) })
      .from(nutrientObservations)
      .where(eq(nutrientObservations.nutrientId, nutrient.id));

    const missingRatio = 1 - Number(observedCount) / Number(variantCount);
    if (missingRatio <= 0.2) continue;

    const [existingTask] = await db
      .select({ id: aiTasks.id })
      .from(aiTasks)
      .where(
        and(
          eq(aiTasks.targetNutrientId, nutrient.id),
          inArray(aiTasks.status, ["pending", "running"]),
        ),
      )
      .limit(1);

    if (existingTask) continue;

    await db.insert(aiTasks).values({
      type: "nutrient_research",
      targetNutrientId: nutrient.id,
      status: "pending",
      createdBy: "scheduler",
    });

    tasksCreated++;
  }

  return tasksCreated;
}
