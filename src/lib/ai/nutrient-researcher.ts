"use server";

import { eq, notInArray, sql } from "drizzle-orm";

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
import { tracedChatCompletion } from "@/lib/openai";

const AI_SOURCE_NAME = "NutriBalance AI Researcher";

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

interface NutrientDataPoint {
  foodName: string;
  preparationMethod: string;
  valuePer100g: number;
  unit: string;
  confidence: number;
  reasoning: string;
}

/**
 * Call OpenAI to research nutrient content for a batch of food variants.
 */
async function researchBatch(
  nutrientName: string,
  nutrientUnit: string,
  batch: { variantId: string; foodName: string; preparationMethod: string }[],
): Promise<NutrientDataPoint[]> {
  const foodList = batch.map((b) => `- ${b.foodName} (${b.preparationMethod})`).join("\n");

  const { completion } = await tracedChatCompletion({
    traceName: "nutrient-research",
    model: "gpt-4o-mini",
    metadata: { nutrient: nutrientName, batchSize: batch.length },
    messages: [
      {
        role: "system",
        content: `You are a nutrition data researcher. You provide estimated nutrient values per 100g of food based on established nutrition databases (USDA, NCCDB, etc.).

Return a JSON array with one object per food item. Each object must have:
- "foodName": string (exact name from the input)
- "preparationMethod": string (exact method from the input)
- "valuePer100g": number (amount of ${nutrientName} in ${nutrientUnit} per 100g)
- "unit": "${nutrientUnit}"
- "confidence": number 0-100 (how confident you are in this value)
- "reasoning": string (brief source or explanation)

If you cannot estimate a value, use valuePer100g: 0 and confidence: 10.
Return ONLY the JSON array, no other text.`,
      },
      {
        role: "user",
        content: `Research the ${nutrientName} (${nutrientUnit}) content per 100g for these foods:\n${foodList}`,
      },
    ],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content ?? "[]";
  const cleaned = content.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(cleaned) as NutrientDataPoint[];
}

/**
 * Process a single AI task: research a nutrient across all foods missing data.
 */
export async function processNutrientResearchTask(taskId: string): Promise<void> {
  // Load the task
  const [task] = await db.select().from(aiTasks).where(eq(aiTasks.id, taskId)).limit(1);
  if (!task || task.status !== "pending") return;

  // Mark as running
  await db
    .update(aiTasks)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(aiTasks.id, taskId));

  try {
    // Get the target nutrient
    const [nutrient] = await db
      .select()
      .from(nutrients)
      .where(eq(nutrients.id, task.targetNutrientId))
      .limit(1);

    if (!nutrient) throw new Error("Nutrient not found");

    // Find food variants missing this nutrient
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

    // Process in batches
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

          // Create source record
          const [record] = await db
            .insert(sourceRecords)
            .values({
              sourceId,
              rawData: result,
            })
            .returning({ id: sourceRecords.id });

          // Create nutrient observation
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

          // Create evidence item with reasoning
          await db.insert(evidenceItems).values({
            observationId: observation.id,
            snippet: result.reasoning,
          });

          processed++;
        }
      } catch {
        errors += batch.length;
      }

      // Update progress
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
  // Get all nutrients
  const allNutrients = await db.select().from(nutrients);
  const totalVariants = await db.select({ count: sql<number>`count(*)` }).from(foodVariants);
  const variantCount = totalVariants[0]?.count ?? 0;

  let tasksCreated = 0;

  for (const nutrient of allNutrients) {
    // Count how many variants already have data for this nutrient
    const [{ count: observedCount }] = await db
      .select({ count: sql<number>`count(distinct ${nutrientObservations.foodVariantId})` })
      .from(nutrientObservations)
      .where(eq(nutrientObservations.nutrientId, nutrient.id));

    // If more than 20% of variants are missing data, create a task
    const missingRatio = 1 - Number(observedCount) / Number(variantCount);
    if (missingRatio <= 0.2) continue;

    // Check if there's already a pending/running task for this nutrient
    const [existingTask] = await db
      .select({ id: aiTasks.id })
      .from(aiTasks)
      .where(
        sql`${aiTasks.targetNutrientId} = ${nutrient.id} AND ${aiTasks.status} IN ('pending', 'running')`,
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
