import { NextResponse } from "next/server";

import { findAndCreateGapTasks } from "@/lib/ai/substance-researcher";
import { handleCronError, verifyCronAuth } from "@/lib/cron-auth";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";
import { checkCronRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/ai-tasks/schedule
 * Daily cron: finds substance data gaps and creates AI tasks to fill them.
 * Protected by CRON_SECRET header.
 */
export { POST as GET };

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const rateLimit = await checkCronRateLimit();
  if (rateLimit.limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
    const { message, logged } = handleCronError("AI task scheduler", error);

    await finishJobRun(run, {
      status: "failed",
      message,
      errorMessage: logged,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
