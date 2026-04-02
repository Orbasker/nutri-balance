"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { processNutrientResearchTask } from "@/lib/ai/nutrient-researcher";
import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";

export type AiTaskActionResult = { ok: true; taskId: string } | { error: string };

export async function createAiTask(nutrientId: string): Promise<AiTaskActionResult> {
  const session = await getSession();

  if (!session) {
    return { error: "You must be signed in." };
  }

  // Check for existing pending/running task for this nutrient
  const [existingTask] = await db
    .select({ id: aiTasks.id, status: aiTasks.status })
    .from(aiTasks)
    .where(eq(aiTasks.targetNutrientId, nutrientId));

  if (existingTask && (existingTask.status === "pending" || existingTask.status === "running")) {
    return { error: "A task for this nutrient is already in progress." };
  }

  const [task] = await db
    .insert(aiTasks)
    .values({
      type: "nutrient_research",
      targetNutrientId: nutrientId,
      status: "pending",
      createdBy: "user",
      userId: session.user.id,
    })
    .returning({ id: aiTasks.id });

  revalidatePath("/ai-tasks");
  return { ok: true, taskId: task.id };
}

export async function runAiTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();

  if (!session) {
    return { error: "You must be signed in." };
  }

  try {
    await processNutrientResearchTask(taskId, "manual");
    revalidatePath("/ai-tasks");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Task processing failed." };
  }
}
