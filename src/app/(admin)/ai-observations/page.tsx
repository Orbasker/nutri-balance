import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

import {
  type AiObservationStatusFilter,
  getAiObservationCounts,
  getAiObservations,
} from "./actions";
import { AiObservationList } from "./observation-list";

const filterConfig: Array<{
  value: AiObservationStatusFilter;
  label: string;
  countKey: "all" | "pending" | "approved" | "rejected" | "needsRevision";
}> = [
  { value: "all", label: "All AI Items", countKey: "all" },
  { value: "approved", label: "Approved", countKey: "approved" },
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "needs_revision", label: "Needs Revision", countKey: "needsRevision" },
  { value: "rejected", label: "Rejected", countKey: "rejected" },
];

function normalizeStatus(status?: string): AiObservationStatusFilter {
  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "needs_revision"
  ) {
    return status;
  }

  return "all";
}

export default async function AiObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: rawStatus, q } = await searchParams;
  const status = normalizeStatus(rawStatus);
  const query = q?.trim() ?? "";

  const [counts, observations] = await Promise.all([
    getAiObservationCounts(),
    getAiObservations({ status, query }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI Generated Items</h2>
          <p className="text-sm text-muted-foreground">
            Review every AI-extracted observation and inspect what was already approved.
          </p>
        </div>

        <form className="flex w-full gap-2 md:max-w-md" method="GET">
          <input type="hidden" name="status" value={status} />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search food, substance, or prep method"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterConfig.map((filter) => {
          const href = query
            ? `/ai-observations?status=${filter.value}&q=${encodeURIComponent(query)}`
            : `/ai-observations?status=${filter.value}`;

          return (
            <Link
              key={filter.value}
              href={href}
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

      <AiObservationList observations={observations} />
    </div>
  );
}
