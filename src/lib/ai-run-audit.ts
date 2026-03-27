import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiRuns } from "@/lib/db/schema/ai-runs";

type JsonRecord = Record<string, unknown>;

type AiRunType = "food_generation" | "nutrient_research_task" | "ai_review";

export interface AiRunHandle {
  id: string;
  type: AiRunType;
  goal: string;
  source: string;
  startedAt: Date;
}

export async function startAiRun(input: {
  type: AiRunType;
  goal: string;
  source: string;
  triggerUserId?: string | null;
  aiTaskId?: string | null;
  foodId?: string | null;
  metadata?: JsonRecord;
}): Promise<AiRunHandle> {
  const startedAt = new Date();
  const [run] = await db
    .insert(aiRuns)
    .values({
      type: input.type,
      status: "running",
      goal: input.goal,
      source: input.source,
      triggerUserId: input.triggerUserId ?? null,
      aiTaskId: input.aiTaskId ?? null,
      foodId: input.foodId ?? null,
      metadata: input.metadata ?? null,
      startedAt,
    })
    .returning({ id: aiRuns.id });

  return {
    id: run.id,
    type: input.type,
    goal: input.goal,
    source: input.source,
    startedAt,
  };
}

export async function finishAiRun(
  handle: AiRunHandle,
  input: {
    status: "completed" | "failed";
    itemCount?: number | null;
    resultSummary?: string | null;
    errorMessage?: string | null;
    foodId?: string | null;
    metadata?: JsonRecord;
  },
): Promise<void> {
  const completedAt = new Date();
  const durationMs = Math.max(0, completedAt.getTime() - handle.startedAt.getTime());

  await db
    .update(aiRuns)
    .set({
      status: input.status,
      completedAt,
      durationMs,
      itemCount: input.itemCount ?? null,
      resultSummary: input.resultSummary ?? null,
      errorMessage: input.errorMessage ?? null,
      foodId: input.foodId ?? null,
      metadata: input.metadata ?? null,
    })
    .where(eq(aiRuns.id, handle.id));
}

export async function incrementAiRunUsage(input: {
  aiRunId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number | null;
}) {
  const updates: {
    inputTokens: ReturnType<typeof sql<number>>;
    outputTokens: ReturnType<typeof sql<number>>;
    totalTokens: ReturnType<typeof sql<number>>;
    estimatedCostUsd?: ReturnType<typeof sql<number>>;
  } = {
    inputTokens: sql`${aiRuns.inputTokens} + ${input.inputTokens}`,
    outputTokens: sql`${aiRuns.outputTokens} + ${input.outputTokens}`,
    totalTokens: sql`${aiRuns.totalTokens} + ${input.totalTokens}`,
  };

  if (input.estimatedCostUsd != null) {
    updates.estimatedCostUsd = sql`coalesce(${aiRuns.estimatedCostUsd}, 0) + ${input.estimatedCostUsd}`;
  }

  await db.update(aiRuns).set(updates).where(eq(aiRuns.id, input.aiRunId));
}
