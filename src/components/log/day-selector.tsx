"use client";

import { useRouter } from "next/navigation";

interface DaySelectorProps {
  currentDate: string;
  todayStr: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Today";

  const yesterday = addDays(todayStr, -1);
  if (dateStr === yesterday) return "Yesterday";

  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DaySelector({ currentDate, todayStr }: DaySelectorProps) {
  const router = useRouter();
  const isToday = currentDate === todayStr;

  const goTo = (dateStr: string) => {
    if (dateStr === todayStr) {
      router.push("/log");
    } else {
      router.push(`/log?date=${dateStr}`);
    }
  };

  return (
    <div className="flex items-center bg-md-surface-container-low rounded-xl p-1">
      <button
        className="p-2 text-md-outline hover:text-md-primary transition-colors"
        onClick={() => goTo(addDays(currentDate, -1))}
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <span className="px-4 font-semibold text-sm">{formatDateLabel(currentDate, todayStr)}</span>
      <button
        className="p-2 text-md-outline hover:text-md-primary transition-colors disabled:opacity-30"
        onClick={() => goTo(addDays(currentDate, 1))}
        disabled={isToday}
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}
