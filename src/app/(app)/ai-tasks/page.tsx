import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiTasks } from "@/lib/db/schema/ai-tasks";
import { substances } from "@/lib/db/schema/substances";

import { CreateTaskForm } from "./create-task-form";
import { AiTaskList } from "./task-list";

export default async function AiTasksPage() {
  const [allSubstances, tasks] = await Promise.all([
    db.select().from(substances).orderBy(substances.sortOrder),
    db
      .select({
        id: aiTasks.id,
        type: aiTasks.type,
        targetSubstanceId: aiTasks.targetSubstanceId,
        status: aiTasks.status,
        createdBy: aiTasks.createdBy,
        progress: aiTasks.progress,
        resultSummary: aiTasks.resultSummary,
        errorMessage: aiTasks.errorMessage,
        createdAt: aiTasks.createdAt,
        startedAt: aiTasks.startedAt,
        completedAt: aiTasks.completedAt,
        substanceName: substances.displayName,
      })
      .from(aiTasks)
      .leftJoin(substances, eq(aiTasks.targetSubstanceId, substances.id))
      .orderBy(desc(aiTasks.createdAt)),
  ]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Research Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Create tasks to automatically research substance data for all foods in the database.
        </p>
      </div>
      <CreateTaskForm substances={allSubstances} />
      <AiTaskList tasks={tasks} />
    </div>
  );
}
