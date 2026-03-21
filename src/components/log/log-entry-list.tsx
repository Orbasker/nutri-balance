"use client";

import type { LogEntry, LogEntryNutrientInfo } from "@/types";

import { LogEntryRow } from "./log-entry-row";

interface LogEntryListProps {
  entries: LogEntry[];
  nutrientInfo: LogEntryNutrientInfo[];
}

type MealGroup = {
  label: string;
  entries: LogEntry[];
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

export function LogEntryList({ entries, nutrientInfo }: LogEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No entries logged for this day.</p>
        <a href="/search" className="text-primary mt-2 inline-block text-sm underline">
          Search for food to add
        </a>
      </div>
    );
  }

  const groups = groupByMeal(entries);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <LogEntryRow key={entry.id} entry={entry} nutrientInfo={nutrientInfo} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
