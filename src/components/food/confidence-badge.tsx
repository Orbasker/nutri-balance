import type { ConfidenceLabel } from "@/types";

const confidenceConfig: Record<ConfidenceLabel, { dots: number; label: string }> = {
  high: { dots: 3, label: "High" },
  good: { dots: 3, label: "Good" },
  moderate: { dots: 2, label: "Moderate" },
  low: { dots: 1, label: "Low" },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLabel;
  score?: number;
}

export function ConfidenceBadge({ level, score }: ConfidenceBadgeProps) {
  const config = confidenceConfig[level];

  return (
    <div className="flex items-center gap-3 bg-md-surface-container-low w-fit px-4 py-2 rounded-full">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${i <= config.dots ? "bg-md-primary" : "bg-md-outline-variant"}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-md-on-surface-variant">
        Confidence: {config.label}
        {score !== undefined && (
          <span className="text-md-outline font-normal"> ({Math.round(score)}%)</span>
        )}
      </span>
    </div>
  );
}
