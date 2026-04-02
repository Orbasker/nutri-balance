import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { processNutrientResearchTask } from "@/lib/ai/nutrient-researcher";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";

/**
 * POST /api/ai-tasks/process
 * Picks up pending AI tasks and processes them.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        await processNutrientResearchTask(task.id, "cron");
        results.push({ taskId: task.id, status: "processed" });
      } catch {
        results.push({ taskId: task.id, status: "error" });
      }
    }

    const errorCount = results.filter((result) => result.status === "error").length;

    await finishJobRun(run, {
      status: "completed",
      message: `Processed ${results.length} queued task${results.length === 1 ? "" : "s"}`,
      recordsProcessed: results.length,
      errorCount,
      metadata: {
        results,
      },
    });

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await finishJobRun(run, {
      status: "failed",
      message: "AI task processor failed",
      errorMessage,
    });

    return NextResponse.json(
      {
        error: "Task processor failed",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
