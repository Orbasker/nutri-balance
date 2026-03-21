import { NextResponse } from "next/server";

import { findAndCreateGapTasks } from "@/lib/ai/nutrient-researcher";

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

  const tasksCreated = await findAndCreateGapTasks();

  return NextResponse.json({
    message: `Scheduled ${tasksCreated} new research tasks`,
    tasksCreated,
  });
}
