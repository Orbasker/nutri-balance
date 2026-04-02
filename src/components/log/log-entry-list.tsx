"use client";

import type { LogEntry, LogEntrySubstanceInfo } from "@/types";

import { LogEntryRow } from "./log-entry-row";

interface LogEntryListProps {
  entries: LogEntry[];
  substanceInfo: LogEntrySubstanceInfo[];
}

type MealGroup = {
  label: string;
  entries: LogEntry[];
};

const mealColors: Record<string, string> = {
  breakfast: "bg-md-primary/10 text-md-primary",
  lunch: "bg-md-secondary/10 text-md-secondary",
  dinner: "bg-md-tertiary/10 text-md-tertiary",
  snack: "bg-md-tertiary/10 text-md-tertiary",
};

function groupByMeal(entries: LogEntry[]): MealGroup[] {
  const groups = new Map<string, LogEntry[]>();

  for (const entry of entries) {
    const label = entry.mealLabel || "Other";
    const group = groups.get(label);
    if (group) {
      group.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    entries: items,
  }));
}

export function LogEntryList({ entries, substanceInfo }: LogEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-md-surface-container-high flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-md-outline">restaurant</span>
        </div>
        <p className="text-md-on-surface-variant">No entries logged for this day.</p>
        <a
          href="/search"
          className="text-md-primary mt-2 inline-block text-sm font-semibold underline"
        >
          Search for food to add
        </a>
      </div>
    );
  }

  const groups = groupByMeal(entries);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          {group.entries.map((entry) => (
            <LogEntryRow
              key={entry.id}
              entry={entry}
              substanceInfo={substanceInfo}
              mealColorClass={
                mealColors[group.label.toLowerCase()] ?? "bg-md-surface-container text-md-outline"
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
