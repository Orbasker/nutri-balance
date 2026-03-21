import type { RecentLogEntry } from "@/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface RecentFoodsCardProps {
  logs: RecentLogEntry[];
}

export function RecentFoodsCard({ logs }: RecentFoodsCardProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Foods</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No foods logged today.{" "}
            <a href="/search" className="text-primary underline underline-offset-4">
              Search for a food
            </a>{" "}
            to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Foods</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{log.foodName}</p>
                <p className="text-muted-foreground text-xs">
                  {log.preparationMethod} &middot; {log.quantity}
                  {log.servingLabel ? ` ${log.servingLabel}` : "g"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {log.mealLabel && (
                  <Badge variant="secondary" className="capitalize">
                    {log.mealLabel}
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatTime(log.loggedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
