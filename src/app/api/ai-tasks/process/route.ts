import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { executeAiReviewRun } from "@/lib/ai/review-runner";
import { processSubstanceResearchTask } from "@/lib/ai/substance-researcher";
import { handleCronError, verifyCronAuth } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";

/**
 * POST /api/ai-tasks/process
 * Picks up pending AI tasks and processes them.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const run = await startJobRun({
    jobKey: "ai-task-processor",
    source: "cron",
  });

  try {
    const pendingTasks = await db
      .select({ id: aiTasks.id, type: aiTasks.type })
      .from(aiTasks)
      .where(eq(aiTasks.status, "pending"))
      .limit(5);

    if (pendingTasks.length === 0) {
      await finishJobRun(run, {
        status: "completed",
        message: "No pending tasks",
      });

      return NextResponse.json({ message: "No pending tasks" });
    }

    const results: { taskId: string; status: string }[] = [];

    for (const task of pendingTasks) {
      try {
        await processSubstanceResearchTask(task.id, "cron");
        results.push({ taskId: task.id, status: "processed" });
      } catch {
        results.push({ taskId: task.id, status: "error" });
      }
    }

    const errorCount = results.filter((result) => result.status === "error").length;
    const successCount = results.length - errorCount;

    // Automatically run review on newly created observations
    let reviewResult = null;
    if (successCount > 0) {
      try {
        reviewResult = await executeAiReviewRun({
          source: "post-process",
          jobRunId: run.id,
        });
      } catch (reviewError) {
        console.error("Post-process review failed:", reviewError);
      }
    }

    await finishJobRun(run, {
      status: "completed",
      message: `Processed ${results.length} queued task${results.length === 1 ? "" : "s"}`,
      recordsProcessed: results.length,
      errorCount,
      metadata: {
        results,
        reviewResult: reviewResult
          ? {
              totalReviewed: reviewResult.totalReviewed,
              approved: reviewResult.approved,
              rejected: reviewResult.rejected,
            }
          : null,
      },
    });

    return NextResponse.json({ processed: results.length, results, reviewResult });
  } catch (error) {
    const { message, logged } = handleCronError("AI task processor", error);

    await finishJobRun(run, {
      status: "failed",
      message,
      errorMessage: logged,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
