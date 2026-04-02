import Link from "next/link";

import { eq } from "drizzle-orm";

import { DailySummary } from "@/components/log/daily-summary";
import { DaySelector } from "@/components/log/day-selector";
import { LogEntryList } from "@/components/log/log-entry-list";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

import { getDailySummary, getLogEntries, getSubstanceInfo } from "./actions";

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

  const session = await getSession();

  let firstName: string | null = null;
  if (session) {
    const [profile] = await db
      .select({ firstName: profiles.firstName, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, session.user.id));
    firstName = profile?.firstName ?? profile?.displayName?.split(/\s+/)[0] ?? null;
  }

  const entries = await getLogEntries(currentDate);

  const [summary, substanceInfo] = await Promise.all([
    getDailySummary(entries),
    getSubstanceInfo([...new Set(entries.flatMap((e) => Object.keys(e.substanceSnapshot)))]),
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
        <LogEntryList entries={entries} substanceInfo={substanceInfo} />
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
