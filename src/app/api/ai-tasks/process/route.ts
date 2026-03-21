import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { processNutrientResearchTask } from "@/lib/ai/nutrient-researcher";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";

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

  const pendingTasks = await db
    .select({ id: aiTasks.id, type: aiTasks.type })
    .from(aiTasks)
    .where(eq(aiTasks.status, "pending"))
    .limit(5);

  if (pendingTasks.length === 0) {
    return NextResponse.json({ message: "No pending tasks" });
  }

  const results: { taskId: string; status: string }[] = [];

  for (const task of pendingTasks) {
    try {
      await processNutrientResearchTask(task.id);
      results.push({ taskId: task.id, status: "processed" });
    } catch {
      results.push({ taskId: task.id, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
