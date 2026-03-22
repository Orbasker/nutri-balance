import Link from "next/link";

import { DailySummary } from "@/components/log/daily-summary";
import { DaySelector } from "@/components/log/day-selector";
import { LogEntryList } from "@/components/log/log-entry-list";

import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, display_name")
      .eq("id", user.id)
      .single();
    firstName = profile?.first_name ?? profile?.display_name?.split(/\s+/)[0] ?? null;
  }

  const entries = await getLogEntries(currentDate);

  const [summary, nutrientInfo] = await Promise.all([
    getDailySummary(entries),
    getNutrientInfo([...new Set(entries.flatMap((e) => Object.keys(e.nutrientSnapshot)))]),
  ]);

  const isToday = currentDate === todayStr;

  return (
    <div className="px-6 max-w-screen-xl mx-auto">
      {/* Editorial Header + Date Selector */}
      <section className="mb-10 pt-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-md-outline uppercase tracking-widest text-[10px] font-bold mb-1">
              {firstName ? `${firstName}\u2019s Timeline` : "Timeline"}
            </p>
            <h2 className="font-extrabold text-3xl text-md-primary">
              {isToday ? "Today" : "History"}
            </h2>
          </div>
          <DaySelector currentDate={currentDate} todayStr={todayStr} />
        </div>
      </section>

      {/* Summary Cards */}
      <DailySummary totals={summary} />

      {/* Meal Log */}
      <section className="space-y-8 mt-8">
        <h3 className="font-bold text-xl px-2">Meal Log</h3>
        <LogEntryList entries={entries} nutrientInfo={nutrientInfo} />
      </section>

      {/* FAB */}
      <Link
        href="/search"
        className="fixed right-6 bottom-24 w-14 h-14 bg-md-primary text-md-on-primary rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,68,147,0.3)] active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined">add</span>
      </Link>
    </div>
  );
}
