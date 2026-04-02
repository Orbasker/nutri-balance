"use server";

import { generateObject } from "ai";
import { and, count, countDistinct, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { type AiRunHandle, finishAiRun, startAiRun } from "@/lib/ai-run-audit";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import {
  evidenceItems,
  sourceRecords,
  sources,
  substanceObservations,
} from "@/lib/db/schema/observations";
import { substances } from "@/lib/db/schema/substances";
import { flushLangfuse } from "@/lib/langfuse";
import { getLangfuse } from "@/lib/langfuse";
import { finishJobRun, recordAiUsageEvent, startJobRun } from "@/lib/ops-monitoring";

const AI_SOURCE_NAME = "NutriBalance AI Researcher";

const substanceDataPointSchema = z.object({
  foodName: z.string(),
  preparationMethod: z.string(),
  valuePer100g: z.number().nonnegative(),
  unit: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

const batchResultSchema = z.object({
  results: z.array(substanceDataPointSchema),
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
 * Find food variants that are missing observations for a given substance.
 */
async function findMissingVariants(substanceId: string) {
  const variantsWithData = db
    .select({ foodVariantId: substanceObservations.foodVariantId })
    .from(substanceObservations)
    .where(eq(substanceObservations.substanceId, substanceId));

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
 * Call AI to research substance content for a batch of food variants.
 */
async function researchBatch(
  substanceName: string,
  substanceUnit: string,
  batch: { variantId: string; foodName: string; preparationMethod: string }[],
  options?: {
    aiTaskId?: string;
    jobRunId?: string;
    aiRunId?: string;
  },
) {
  const foodList = batch.map((b) => `- ${b.foodName} (${b.preparationMethod})`).join("\n");
  const model = getModel();

  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "substance-research-batch",
    metadata: { substance: substanceName, batchSize: batch.length },
  });

  const modelName = typeof model === "string" ? model : model.modelId;

  const generation = trace.generation({
    name: "research-batch",
    model: modelName,
    input: { substanceName, foodList },
  });

  const { object, usage } = await generateObject({
    model,
    schema: batchResultSchema,
    prompt: `You are a nutrition data researcher. Estimate ${substanceName} (${substanceUnit}) content per 100g for these foods:
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

  await recordAiUsageEvent({
    feature: "ai-task-research",
    operation: "substance-research-batch",
    model: modelName,
    aiTaskId: options?.aiTaskId,
    jobRunId: options?.jobRunId,
    aiRunId: options?.aiRunId,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    },
    metadata: {
      substanceName,
      batchSize: batch.length,
    },
  });

  return object.results;
}

/**
 * Process a single AI task: research a substance across all foods missing data.
 */
export async function processSubstanceResearchTask(
  taskId: string,
  source: "cron" | "manual" = "manual",
): Promise<void> {
  const [task] = await db.select().from(aiTasks).where(eq(aiTasks.id, taskId)).limit(1);
  if (!task || task.status !== "pending") return;

  const run = await startJobRun({
    jobKey: "substance-research-task",
    source,
    aiTaskId: taskId,
    metadata: {
      targetSubstanceId: task.targetSubstanceId,
    },
  });

  let processed = 0;
  let errors = 0;
  let totalMissing = 0;
  let substanceName = "Unknown substance";
  let aiRun: AiRunHandle | null = null;

  try {
    await db
      .update(aiTasks)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(aiTasks.id, taskId));

    const [substance] = await db
      .select()
      .from(substances)
      .where(eq(substances.id, task.targetSubstanceId))
      .limit(1);

    if (!substance) throw new Error("Substance not found");
    substanceName = substance.displayName;
    aiRun = await startAiRun({
      type: "substance_research_task",
      goal: `Research missing ${substance.displayName} values`,
      source,
      aiTaskId: taskId,
      metadata: {
        substanceId: substance.id,
        substanceName: substance.displayName,
      },
    });

    const missing = await findMissingVariants(substance.id);
    totalMissing = missing.length;

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

      await finishJobRun(run, {
        status: "completed",
        message: `No missing data found for ${substance.displayName}`,
        metadata: {
          substanceId: substance.id,
          substanceName: substance.displayName,
        },
      });

      if (aiRun) {
        await finishAiRun(aiRun, {
          status: "completed",
          itemCount: 0,
          resultSummary: `No missing data found for ${substance.displayName}.`,
          metadata: {
            substanceId: substance.id,
            substanceName: substance.displayName,
          },
        });
      }
      return;
    }

    const sourceId = await getOrCreateAiSource();
    const BATCH_SIZE = 10;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);

      try {
        const results = await researchBatch(substance.name, substance.unit, batch, {
          aiTaskId: taskId,
          jobRunId: run.id,
          aiRunId: aiRun?.id,
        });

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
            .insert(substanceObservations)
            .values({
              foodVariantId: variant.variantId,
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
        resultSummary: `Researched ${processed} food variants for ${substance.displayName}. ${errors} errors.`,
      })
      .where(eq(aiTasks.id, taskId));

    await finishJobRun(run, {
      status: "completed",
      message: `Researched ${processed} variants for ${substance.displayName}`,
      recordsProcessed: processed,
      errorCount: errors,
      metadata: {
        substanceId: substance.id,
        substanceName: substance.displayName,
        totalMissing: missing.length,
      },
    });

    if (aiRun) {
      await finishAiRun(aiRun, {
        status: "completed",
        itemCount: processed,
        resultSummary: `Researched ${processed} food variants for ${substance.displayName}.`,
        metadata: {
          substanceId: substance.id,
          substanceName: substance.displayName,
          totalMissing: missing.length,
          errors,
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(aiTasks)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(aiTasks.id, taskId));

    await finishJobRun(run, {
      status: "failed",
      message: `Research failed for ${substanceName}`,
      errorMessage,
      recordsProcessed: processed,
      errorCount: errors,
      metadata: {
        totalMissing,
      },
    });

    if (aiRun) {
      await finishAiRun(aiRun, {
        status: "failed",
        itemCount: processed,
        errorMessage,
        resultSummary: `Research failed for ${substanceName}.`,
        metadata: {
          totalMissing,
          errors,
        },
      });
    }
  } finally {
    await flushLangfuse();
  }
}

/**
 * Find substance data gaps and create tasks to fill them.
 * Called by the daily scheduler.
 */
export async function findAndCreateGapTasks(): Promise<number> {
  const allSubstances = await db.select().from(substances);
  const totalVariants = await db.select({ count: count() }).from(foodVariants);
  const variantCount = totalVariants[0]?.count ?? 0;

  let tasksCreated = 0;

  for (const substance of allSubstances) {
    const [{ count: observedCount }] = await db
      .select({ count: countDistinct(substanceObservations.foodVariantId) })
      .from(substanceObservations)
      .where(eq(substanceObservations.substanceId, substance.id));

    const missingRatio = 1 - Number(observedCount) / Number(variantCount);
    if (missingRatio <= 0.2) continue;

    const [existingTask] = await db
      .select({ id: aiTasks.id })
      .from(aiTasks)
      .where(
        and(
          eq(aiTasks.targetSubstanceId, substance.id),
          inArray(aiTasks.status, ["pending", "running"]),
        ),
      )
      .limit(1);

    if (existingTask) continue;

    await db.insert(aiTasks).values({
      type: "substance_research",
      targetSubstanceId: substance.id,
      status: "pending",
      createdBy: "scheduler",
    });

    tasksCreated++;
  }

  return tasksCreated;
}
