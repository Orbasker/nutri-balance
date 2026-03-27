"use server";

import { revalidatePath } from "next/cache";

import type { AiRunItem, AiRunStatusCounts } from "@/types";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { executeAiReviewRun } from "@/lib/ai/review-runner";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { aiRuns } from "@/lib/db/schema/ai-runs";
import { user } from "@/lib/db/schema/auth";

export type AiRunStatusFilter = "all" | "running" | "completed" | "failed";
export type AiRunTypeFilter = "all" | "food_generation" | "nutrient_research_task" | "ai_review";

const emptyCounts: AiRunStatusCounts = {
  all: 0,
  running: 0,
  completed: 0,
  failed: 0,
};

export async function getAiRunCounts(): Promise<AiRunStatusCounts> {
  const adminId = await requireAdmin();
  if (!adminId) return emptyCounts;

  const rows = await db
    .select({
      status: aiRuns.status,
      count: sql<number>`count(*)`,
    })
    .from(aiRuns)
    .groupBy(aiRuns.status);

  return rows.reduce<AiRunStatusCounts>(
    (acc, row) => {
      const count = Number(row.count);
      acc.all += count;

      if (row.status === "running") acc.running = count;
      if (row.status === "completed") acc.completed = count;
      if (row.status === "failed") acc.failed = count;

      return acc;
    },
    { ...emptyCounts },
  );
}

export async function getAiRuns(input?: {
  status?: AiRunStatusFilter;
  type?: AiRunTypeFilter;
  query?: string;
}): Promise<AiRunItem[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  const status = input?.status ?? "all";
  const type = input?.type ?? "all";
  const query = input?.query?.trim();
  const conditions = [];

  if (status !== "all") {
    conditions.push(eq(aiRuns.status, status));
  }

  if (type !== "all") {
    conditions.push(eq(aiRuns.type, type));
  }

  if (query) {
    const search = `%${query}%`;
    conditions.push(
      or(
        ilike(aiRuns.goal, search),
        ilike(aiRuns.source, search),
        ilike(user.email, search),
        ilike(user.name, search),
      )!,
    );
  }

  const rows = await db
    .select({
      id: aiRuns.id,
      type: aiRuns.type,
      status: aiRuns.status,
      goal: aiRuns.goal,
      source: aiRuns.source,
      itemCount: aiRuns.itemCount,
      inputTokens: aiRuns.inputTokens,
      outputTokens: aiRuns.outputTokens,
      totalTokens: aiRuns.totalTokens,
      estimatedCostUsd: aiRuns.estimatedCostUsd,
      resultSummary: aiRuns.resultSummary,
      errorMessage: aiRuns.errorMessage,
      startedAt: aiRuns.startedAt,
      completedAt: aiRuns.completedAt,
      durationMs: aiRuns.durationMs,
      aiTaskId: aiRuns.aiTaskId,
      foodId: aiRuns.foodId,
      triggerUserId: aiRuns.triggerUserId,
      triggerUserName: user.name,
      triggerUserEmail: user.email,
    })
    .from(aiRuns)
    .leftJoin(user, eq(user.id, aiRuns.triggerUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiRuns.startedAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    goal: row.goal,
    source: row.source,
    itemCount: row.itemCount,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    estimatedCostUsd: row.estimatedCostUsd == null ? null : Number(row.estimatedCostUsd),
    resultSummary: row.resultSummary,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    aiTaskId: row.aiTaskId,
    foodId: row.foodId,
    triggerUserId: row.triggerUserId,
    triggerUserName: row.triggerUserName,
    triggerUserEmail: row.triggerUserEmail,
  }));
}

export async function runReviewerNow() {
  const adminId = await requireAdmin();

  if (!adminId) {
    return { error: "Unauthorized" as const };
  }

  try {
    const result = await executeAiReviewRun({
      source: "admin",
      triggerUserId: adminId,
    });

    revalidatePath("/ai-runs");
    revalidatePath("/ai-observations");

    return {
      ok: true as const,
      message:
        result.totalReviewed === 0
          ? "No pending AI observations to review."
          : `Reviewed ${result.totalReviewed} observations.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Reviewer run failed.",
    };
  }
}
