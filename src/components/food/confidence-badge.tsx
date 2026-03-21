import type { ConfidenceLabel } from "@/types";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

const confidenceConfig: Record<ConfidenceLabel, { className: string; label: string }> = {
  high: {
    className: "bg-[#72fe88]/15 text-[#00531c] dark:bg-[#68f47f]/15 dark:text-[#68f47f]",
    label: "High",
  },
  good: {
    className: "bg-[#d8e2ff] text-[#004493] dark:bg-[#adc6ff]/15 dark:text-[#adc6ff]",
    label: "Good",
  },
  moderate: {
    className: "bg-[#e2dfff] text-[#4c4aca] dark:bg-[#c2c1ff]/15 dark:text-[#c2c1ff]",
    label: "Moderate",
  },
  low: {
    className: "bg-[#ffdad6] text-[#ba1a1a] dark:bg-[#ffb4ab]/15 dark:text-[#ffb4ab]",
    label: "Low",
  },
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
