"use client";

import type { SubstanceImpact } from "@/types";

interface SubstanceImpactPanelProps {
  impacts: SubstanceImpact[];
  portionGrams: number;
  mealLabel: string;
  onMealLabelChange: (label: string) => void;
  onAddToToday: () => void;
  pending: boolean;
  error: string | null;
  success: boolean;
}

const statusBarColor: Record<string, string> = {
  safe: "bg-md-tertiary",
  caution: "bg-md-secondary",
  exceed: "bg-md-error",
};

const statusLabelColor: Record<string, string> = {
  safe: "text-md-tertiary",
  caution: "text-md-secondary",
  exceed: "text-md-error",
};

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  safe: { bg: "", text: "", label: "" },
  caution: { bg: "bg-md-secondary-fixed", text: "text-md-on-secondary-fixed", label: "Caution" },
  exceed: {
    bg: "bg-md-error-container",
    text: "text-md-on-error-container",
    label: "Limit Exceeded",
  },
};

export function SubstanceImpactPanel({
  impacts,
  portionGrams,
  mealLabel,
  onMealLabelChange,
  onAddToToday,
  pending,
  error,
  success,
}: SubstanceImpactPanelProps) {
  const trackedImpacts = impacts.filter((i) => i.dailyLimit !== null);

  // Determine overall status
  const worstStatus = trackedImpacts.reduce((worst, i) => {
    if (i.status === "exceed") return "exceed";
    if (i.status === "caution" && worst !== "exceed") return "caution";
    return worst;
  }, "safe" as string);

  const overallLabel =
    worstStatus === "safe" ? "Safe Range" : worstStatus === "caution" ? "Caution" : "Exceeds Limit";
  const overallColor = statusLabelColor[worstStatus] ?? "text-md-tertiary";

  return (
    <div className="space-y-8">
      {/* Impact Simulation Card */}
      <div className="bg-md-surface-container rounded-[2rem] p-8 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h4 className="text-sm font-bold text-md-outline uppercase tracking-widest mb-1">
              Daily Status
            </h4>
            <p className={`text-2xl font-extrabold ${overallColor}`}>{overallLabel}</p>
          </div>
          {trackedImpacts.length > 0 && (
            <div className="text-right">
              <span className="text-md-on-surface-variant text-sm">
                {portionGrams.toFixed(0)}g serving
              </span>
            </div>
          )}
        </div>

        {trackedImpacts.length > 0 ? (
          <div className="space-y-5">
            {trackedImpacts.map((impact) => {
              const pct =
                impact.dailyLimit && impact.dailyLimit > 0
                  ? Math.min((impact.newTotal / impact.dailyLimit) * 100, 100)
                  : 0;
              const badge = statusBadge[impact.status];
              const barColor = statusBarColor[impact.status] ?? "bg-md-primary";
              const labelColor = statusLabelColor[impact.status] ?? "text-md-primary";

              return (
                <div key={impact.substanceId} className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-md-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span>{impact.displayName}</span>
                      {badge?.label && (
                        <span
                          className={`${badge.bg} ${badge.text} text-xs px-3 py-0.5 rounded-full font-bold uppercase tracking-tighter normal-case`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <span className={labelColor}>
                      +{impact.addedAmount.toFixed(1)} {impact.unit}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-md-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full liquid-inner-glow`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {impact.status === "exceed" && impact.dailyLimit && (
                    <p className="text-sm text-md-error font-bold italic">
                      After this meal: {impact.newTotal.toFixed(1)} / {impact.dailyLimit.toFixed(1)}{" "}
                      {impact.unit}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-md-on-surface-variant text-sm">
            No tracking limits configured.{" "}
            <a href="/settings" className="text-md-primary font-semibold underline">
              Set up limits
            </a>{" "}
            to see the impact.
          </p>
        )}

        {/* Alert for exceeded substances */}
        {trackedImpacts.some((i) => i.status === "exceed") && (
          <div className="bg-white p-5 rounded-2xl flex gap-4 items-start shadow-[0_10px_30px_rgba(0,68,147,0.06)]">
            <div className="w-10 h-10 rounded-xl bg-md-primary-container/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-md-primary font-bold">info</span>
            </div>
            <p className="text-sm font-medium leading-relaxed">
              {trackedImpacts
                .filter((i) => i.status === "exceed")
                .map(
                  (i) =>
                    `${i.displayName} will exceed your daily limit by ${(i.newTotal - (i.dailyLimit ?? 0)).toFixed(1)} ${i.unit}`,
                )
                .join(". ")}
              .
            </p>
          </div>
        )}
      </div>

      {/* Meal Label */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-md-outline uppercase tracking-wide">Meal:</span>
        <input
          type="text"
          placeholder="e.g. Breakfast, Lunch, Snack"
          value={mealLabel}
          onChange={(e) => onMealLabelChange(e.target.value)}
          className="flex-1 bg-md-surface-container-lowest border border-md-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:border-md-primary focus:ring-1 focus:ring-md-primary/20 outline-none transition-colors"
        />
      </div>

      {/* CTA */}
      <section className="sticky bottom-24 z-40 pt-6">
        <div className="flex justify-center pointer-events-none">
          <button
            onClick={onAddToToday}
            disabled={pending || success}
            className="pointer-events-auto bg-md-primary text-white px-10 py-5 rounded-full font-extrabold text-lg shadow-[0_15px_35px_rgba(0,68,147,0.2)] active:scale-95 transition-all duration-200 flex items-center gap-3 disabled:opacity-60"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {success ? "check_circle" : "add_circle"}
            </span>
            {pending ? "Adding..." : success ? "Added to today" : "Add to today"}
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-md-error text-center">{error}</p>}
    </div>
  );
}
