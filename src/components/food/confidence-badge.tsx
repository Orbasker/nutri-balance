import type { ConfidenceLabel } from "@/types";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

const confidenceConfig: Record<ConfidenceLabel, { className: string; label: string }> = {
  high: {
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    label: "High",
  },
  good: {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    label: "Good",
  },
  moderate: {
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    label: "Moderate",
  },
  low: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Low" },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLabel;
  className?: string;
}

export function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const config = confidenceConfig[level];
  return (
    <Badge variant="outline" className={cn(config.className, "border-0", className)}>
      {config.label}
    </Badge>
  );
}
