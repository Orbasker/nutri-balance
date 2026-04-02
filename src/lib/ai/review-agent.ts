"use server";

import { generateObject } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { evidenceItems, substanceObservations } from "@/lib/db/schema/observations";
import { resolvedSubstanceValues, reviews } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { flushLangfuse, getLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";

const AI_REVIEWER_ID = "ai-review-agent";

const BATCH_SIZE = 15;

/** Schema for a single AI review verdict */
const verdictSchema = z.object({
  observationId: z.string(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().describe("Brief explanation for the decision"),
});

const batchVerdictSchema = z.object({
  verdicts: z.array(verdictSchema),
});

interface PendingItem {
  id: string;
  foodName: string;
  preparationMethod: string;
  substanceDisplayName: string;
  substanceName: string;
  substanceUnit: string;
  value: string;
  unit: string;
  confidenceScore: number | null;
  evidenceSnippets: string[];
}

/**
 * Fetch all pending AI-extracted observations with context.
 */
async function fetchPendingObservations(): Promise<PendingItem[]> {
  const rows = await db
    .select({
      id: substanceObservations.id,
      foodName: foods.name,
      preparationMethod: foodVariants.preparationMethod,
      substanceDisplayName: substances.displayName,
      substanceName: substances.name,
      substanceUnit: substances.unit,
      value: substanceObservations.value,
      unit: substanceObservations.unit,
      confidenceScore: substanceObservations.confidenceScore,
    })
    .from(substanceObservations)
    .innerJoin(foodVariants, eq(foodVariants.id, substanceObservations.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(substances, eq(substances.id, substanceObservations.substanceId))
    .where(
      and(
        eq(substanceObservations.reviewStatus, "pending"),
        eq(substanceObservations.derivationType, "ai_extracted"),
      ),
    )
    .orderBy(foods.name, substances.sortOrder);

  if (rows.length === 0) return [];

  // Batch fetch evidence
  const obsIds = rows.map((r) => r.id);
  const evidence = await db
    .select({
      observationId: evidenceItems.observationId,
      snippet: evidenceItems.snippet,
    })
    .from(evidenceItems)
    .where(inArray(evidenceItems.observationId, obsIds));

  const evidenceMap = new Map<string, string[]>();
  for (const e of evidence) {
    const list = evidenceMap.get(e.observationId) ?? [];
    if (e.snippet) list.push(e.snippet);
    evidenceMap.set(e.observationId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    foodName: r.foodName,
    preparationMethod: r.preparationMethod,
    substanceDisplayName: r.substanceDisplayName,
    substanceName: r.substanceName,
    substanceUnit: r.substanceUnit,
    value: r.value,
    unit: r.unit,
    confidenceScore: r.confidenceScore,
    evidenceSnippets: evidenceMap.get(r.id) ?? [],
  }));
}

/**
 * Ask AI to verify a batch of observations and return approve/reject verdicts.
 */
async function reviewBatch(
  batch: PendingItem[],
  trace: ReturnType<ReturnType<typeof getLangfuse>["trace"]>,
  options?: {
    jobRunId?: string;
    aiRunId?: string;
  },
) {
  const itemList = batch
    .map((item, i) => {
      const evidence = item.evidenceSnippets.length
        ? `Evidence: ${item.evidenceSnippets.join("; ")}`
        : "No evidence provided";
      return `${i + 1}. [ID: ${item.id}] ${item.foodName} (${item.preparationMethod}) — ${item.substanceDisplayName}: ${item.value} ${item.unit} per 100g (confidence: ${item.confidenceScore ?? "unknown"}) | ${evidence}`;
    })
    .join("\n");

  const model = getModel();
  const modelName = typeof model === "string" ? model : model.modelId;

  const generation = trace.generation({
    name: "review-batch",
    model: modelName,
    input: { batchSize: batch.length },
  });

  const { object, usage } = await generateObject({
    model,
    schema: batchVerdictSchema,
    prompt: `You are a nutrition data quality reviewer. Your job is to verify AI-generated substance values for foods.

For each observation below, decide whether to APPROVE or REJECT it.

APPROVE if:
- The value is within a plausible range for that food and substance (based on USDA FoodData Central or established nutrition databases)
- The evidence reasoning is coherent and references legitimate sources
- The value correctly accounts for the preparation method (e.g., boiling reduces water-soluble vitamins)

REJECT if:
- The value is clearly wrong (e.g., 500mg vitamin C per 100g of chicken, or 0g protein per 100g of beef)
- The value is off by more than 2x from established reference ranges
- The confidence score is very low (<30) and the evidence is weak or nonsensical
- The unit doesn't match the substance type
- The value appears to be for a different food or preparation method

Be strict but fair. When in doubt about borderline cases, APPROVE with a note. Only REJECT values that are clearly incorrect.

Observations to review:
${itemList}

Return a verdict for EVERY observation listed. Use the exact observation ID from each item.`,
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
    feature: "ai-review",
    operation: "review-batch",
    model: modelName,
    jobRunId: options?.jobRunId,
    aiRunId: options?.aiRunId,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    },
    metadata: {
      batchSize: batch.length,
    },
  });

  return object.verdicts;
}

/**
 * Apply a single verdict: update observation status, create review record,
 * and delete resolved values for rejected items.
 */
async function applyVerdict(verdict: z.infer<typeof verdictSchema>) {
  const status = verdict.decision === "approve" ? "approved" : "rejected";

  // Update observation review status
  await db
    .update(substanceObservations)
    .set({ reviewStatus: status })
    .where(eq(substanceObservations.id, verdict.observationId));

  // Create audit trail
  await db.insert(reviews).values({
    entityType: "substance_observation",
    entityId: verdict.observationId,
    reviewerId: AI_REVIEWER_ID,
    status,
    notes: `[AI Review] ${verdict.reason}`,
  });

  // For rejected observations, remove the resolved substance value
  if (verdict.decision === "reject") {
    // Look up the observation to find foodVariantId + substanceId
    const [obs] = await db
      .select({
        foodVariantId: substanceObservations.foodVariantId,
        substanceId: substanceObservations.substanceId,
      })
      .from(substanceObservations)
      .where(eq(substanceObservations.id, verdict.observationId))
      .limit(1);

    if (obs) {
      await db
        .delete(resolvedSubstanceValues)
        .where(
          and(
            eq(resolvedSubstanceValues.foodVariantId, obs.foodVariantId),
            eq(resolvedSubstanceValues.substanceId, obs.substanceId),
          ),
        );
    }
  }
}

export interface ReviewResult {
  totalReviewed: number;
  approved: number;
  rejected: number;
  errors: number;
}

/**
 * Main entry point: fetch all pending AI-extracted observations,
 * send them to AI for verification, and apply verdicts.
 */
export async function runAiReview(options?: {
  jobRunId?: string;
  aiRunId?: string;
  source?: string;
}): Promise<ReviewResult> {
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "ai-review-agent",
    metadata: { trigger: options?.source ?? "api" },
  });

  try {
    const pending = await fetchPendingObservations();

    if (pending.length === 0) {
      trace.update({ output: { message: "No pending observations to review" } });
      await flushLangfuse();
      return { totalReviewed: 0, approved: 0, rejected: 0, errors: 0 };
    }

    let approved = 0;
    let rejected = 0;
    let errors = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      try {
        const verdicts = await reviewBatch(batch, trace, {
          jobRunId: options?.jobRunId,
          aiRunId: options?.aiRunId,
        });

        for (const verdict of verdicts) {
          try {
            await applyVerdict(verdict);
            if (verdict.decision === "approve") approved++;
            else rejected++;
          } catch (err) {
            console.error(`Failed to apply verdict for ${verdict.observationId}:`, err);
            errors++;
          }
        }
      } catch (err) {
        console.error(`Failed to review batch starting at index ${i}:`, err);
        errors += batch.length;
      }
    }

    const result: ReviewResult = {
      totalReviewed: approved + rejected,
      approved,
      rejected,
      errors,
    };

    trace.update({ output: result });
    await flushLangfuse();

    return result;
  } catch (error) {
    trace.update({
      output: { error: error instanceof Error ? error.message : String(error) },
    });
    await flushLangfuse();
    throw error;
  }
}
