import { NextResponse } from "next/server";

import { findAndCreateGapTasks } from "@/lib/ai/nutrient-researcher";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";

/**
 * POST /api/ai-tasks/schedule
 * Daily cron: finds nutrient data gaps and creates AI tasks to fill them.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await startJobRun({
    jobKey: "ai-task-scheduler",
    source: "cron",
  });

  try {
    const tasksCreated = await findAndCreateGapTasks();

    await finishJobRun(run, {
      status: "completed",
      message: `Scheduled ${tasksCreated} new research tasks`,
      recordsProcessed: tasksCreated,
    });

    return NextResponse.json({
      message: `Scheduled ${tasksCreated} new research tasks`,
      tasksCreated,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await finishJobRun(run, {
      status: "failed",
      message: "AI task scheduler failed",
      errorMessage,
    });

    return NextResponse.json(
      {
        error: "Scheduler failed",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
