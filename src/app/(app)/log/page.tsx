import Link from "next/link";

import { Search } from "lucide-react";

import { DailySummary } from "@/components/log/daily-summary";
import { DaySelector } from "@/components/log/day-selector";
import { LogEntryList } from "@/components/log/log-entry-list";
import { Button } from "@/components/ui/button";

import { getDailySummary, getLogEntries, getNutrientInfo } from "./actions";

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const todayStr = getTodayStr();
  const currentDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr;

  const entries = await getLogEntries(currentDate);

  const [summary, nutrientInfo] = await Promise.all([
    getDailySummary(entries),
    getNutrientInfo([...new Set(entries.flatMap((e) => Object.keys(e.nutrientSnapshot)))]),
  ]);

  const dateLabel =
    currentDate === todayStr
      ? "Today's nutrient intake"
      : `Intake for ${new Date(currentDate + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}`;

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Log</h1>
        <Link href="/search">
          <Button variant="outline" size="sm">
            <Search className="mr-1 h-4 w-4" />
            Add food
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <DaySelector currentDate={currentDate} todayStr={todayStr} />
      </div>

      <div className="mb-6">
        <DailySummary totals={summary} dateLabel={dateLabel} />
      </div>

      <LogEntryList entries={entries} nutrientInfo={nutrientInfo} />
    </div>
  );
}
