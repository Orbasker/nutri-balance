import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { nutrients } from "@/lib/db/schema/nutrients";

import { CreateTaskForm } from "./create-task-form";
import { AiTaskList } from "./task-list";

export default async function AiTasksPage() {
  const [allNutrients, tasks] = await Promise.all([
    db.select().from(nutrients).orderBy(nutrients.sortOrder),
    db
      .select({
        id: aiTasks.id,
        type: aiTasks.type,
        targetNutrientId: aiTasks.targetNutrientId,
        status: aiTasks.status,
        createdBy: aiTasks.createdBy,
        progress: aiTasks.progress,
        resultSummary: aiTasks.resultSummary,
        errorMessage: aiTasks.errorMessage,
        createdAt: aiTasks.createdAt,
        startedAt: aiTasks.startedAt,
        completedAt: aiTasks.completedAt,
        nutrientName: nutrients.displayName,
      })
      .from(aiTasks)
      .leftJoin(nutrients, eq(aiTasks.targetNutrientId, nutrients.id))
      .orderBy(desc(aiTasks.createdAt)),
  ]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Research Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Create tasks to automatically research nutrient data for all foods in the database.
        </p>
      </div>

      <CreateTaskForm nutrients={allNutrients} />
      <AiTaskList tasks={tasks} />
    </div>
  );
}
