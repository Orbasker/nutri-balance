import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

import { type AiRunStatusFilter, type AiRunTypeFilter, getAiRunCounts, getAiRuns } from "./actions";
import { RunReviewerButton } from "./run-reviewer-button";

const statusFilters: Array<{
  value: AiRunStatusFilter;
  label: string;
  countKey: "all" | "running" | "completed" | "failed";
}> = [
  { value: "all", label: "All Runs", countKey: "all" },
  { value: "running", label: "Running", countKey: "running" },
  { value: "completed", label: "Completed", countKey: "completed" },
  { value: "failed", label: "Failed", countKey: "failed" },
];

const typeFilters: Array<{ value: AiRunTypeFilter; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "food_generation", label: "Food Generation" },
  { value: "substance_research_task", label: "Research Tasks" },
  { value: "ai_review", label: "AI Review" },
];

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

function normalizeStatus(status?: string): AiRunStatusFilter {
  if (status === "running" || status === "completed" || status === "failed") {
    return status;
  }

  return "all";
}

function normalizeType(type?: string): AiRunTypeFilter {
  if (type === "food_generation" || type === "substance_research_task" || type === "ai_review") {
    return type;
  }

  return "all";
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) return "In progress";
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${(durationMs / 60_000).toFixed(1)}m`;
}

function formatUsd(value: number | null) {
  if (value == null) return "n/a";
  return `$${value.toFixed(6)}`;
}

function formatTypeLabel(type: string) {
  return type.replace(/_/g, " ");
}

export default async function AiRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const { status: rawStatus, type: rawType, q } = await searchParams;
  const status = normalizeStatus(rawStatus);
  const type = normalizeType(rawType);
  const query = q?.trim() ?? "";

  const [counts, runs] = await Promise.all([getAiRunCounts(), getAiRuns({ status, type, query })]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">AI Runs</h2>
          <p className="text-sm text-muted-foreground">
            Audit what ran, why it ran, how long it took, and what it produced.
          </p>
        </div>
        <RunReviewerButton />
      </div>

      <form className="flex flex-col gap-3 lg:flex-row lg:items-center" method="GET">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const href = new URLSearchParams();
            href.set("status", filter.value);
            if (type !== "all") href.set("type", type);
            if (query) href.set("q", query);

            return (
              <Link
                key={filter.value}
                href={`/ai-runs?${href.toString()}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  status === filter.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{filter.label}</span>
                <Badge variant={status === filter.value ? "default" : "outline"}>
                  {counts[filter.countKey]}
                </Badge>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <select
            name="type"
            defaultValue={type}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {typeFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={query} placeholder="Search goal, source, or user email" />
        </div>
      </form>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No AI runs matched this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{run.goal}</CardTitle>
                      <Badge variant={statusVariant[run.status] ?? "outline"}>{run.status}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {formatTypeLabel(run.type)}
                      </Badge>
                    </div>
                    <CardDescription>
                      Started {new Date(run.startedAt).toLocaleString()} ·{" "}
                      {formatDuration(run.durationMs)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {run.foodId && (
                      <Link
                        href={`/foods/${run.foodId}`}
                        className="text-sm text-primary underline"
                      >
                        View food
                      </Link>
                    )}
                    {run.aiTaskId && (
                      <Link href="/ai-tasks" className="text-sm text-primary underline">
                        View task
                      </Link>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="font-medium text-foreground">Source</p>
                    <p>{run.source}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Triggered By</p>
                    <p>{run.triggerUserEmail ?? run.triggerUserName ?? "System"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Items</p>
                    <p>{run.itemCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tokens / Cost</p>
                    <p>
                      {run.totalTokens.toLocaleString()} tokens · {formatUsd(run.estimatedCostUsd)}
                    </p>
                  </div>
                </div>

                {run.resultSummary && <p className="text-sm">{run.resultSummary}</p>}
                {run.errorMessage && <p className="text-sm text-destructive">{run.errorMessage}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
