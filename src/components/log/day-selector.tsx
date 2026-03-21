"use client";

import { useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DaySelectorProps {
  currentDate: string; // YYYY-MM-DD
  todayStr: string; // YYYY-MM-DD
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
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={() => goTo(addDays(currentDate, -1))}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        Prev
      </Button>
      <div className="text-center">
        <span className="text-sm font-medium">{formatDateLabel(currentDate, todayStr)}</span>
        {currentDate !== todayStr && (
          <span className="text-muted-foreground ml-2 text-xs">{currentDate}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => goTo(addDays(currentDate, 1))}
        disabled={isToday}
      >
        Next
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
