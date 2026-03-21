"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { runAiTask } from "./actions";

interface TaskProgress {
  processed: number;
  total: number;
  errors: number;
}

interface AiTask {
  id: string;
  type: string;
  status: string;
  createdBy: string;
  progress: TaskProgress | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  nutrientName: string | null;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

function TaskCard({ task }: { task: AiTask }) {
  const [runState, runAction, isRunning] = useActionState(async () => {
    const result = await runAiTask(task.id);
    if ("error" in result) return { error: result.error };
    return { ok: true };
  }, null);

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Research {task.nutrientName ?? "Unknown Nutrient"}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[task.status] ?? "outline"}>{task.status}</Badge>
            <Badge variant="secondary">{task.createdBy}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Created {task.createdAt.toLocaleString()}
          {task.completedAt && ` · Completed ${task.completedAt.toLocaleString()}`}
        </p>

        {task.progress && (
          <div className="text-sm">
            Processed {task.progress.processed} / {task.progress.total}
            {task.progress.errors > 0 && (
              <span className="text-destructive"> · {task.progress.errors} errors</span>
            )}
          </div>
        )}

        {task.resultSummary && <p className="text-sm">{task.resultSummary}</p>}

        {task.errorMessage && <p className="text-sm text-destructive">{task.errorMessage}</p>}

        {task.status === "pending" && (
          <div>
            <Button size="sm" variant="outline" onClick={() => runAction()} disabled={isRunning}>
              {isRunning ? "Running…" : "Run Now"}
            </Button>
            {runState?.error && <p className="mt-1 text-sm text-destructive">{runState.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AiTaskList({ tasks }: { tasks: AiTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks yet. Create one above to start researching nutrient data.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Tasks</h2>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
