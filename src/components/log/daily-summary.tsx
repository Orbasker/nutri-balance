import type { DailyNutrientTotal } from "@/types";

interface DailySummaryProps {
  totals: DailyNutrientTotal[];
}

export function DailySummary({ totals }: DailySummaryProps) {
  // Calculate total calories (sum of all nutrient totals as a proxy, or use first nutrient)
  const totalCalories = totals.reduce((sum, n) => sum + n.total, 0);
  const totalLimit = totals.reduce((sum, n) => sum + (n.dailyLimit ?? 0), 0);
  const overallPct = totalLimit > 0 ? Math.min((totalCalories / totalLimit) * 100, 100) : 0;

  // Pick first 3 nutrients as "macros" for display
  const macros = totals.slice(0, 3);
  const macroColors = ["bg-md-primary", "bg-md-secondary", "bg-md-tertiary"];

  if (totals.length === 0) {
    return (
      <div className="bg-md-surface-container-low rounded-[2rem] p-8 text-center">
        <p className="text-md-on-surface-variant text-sm">
          No nutrient limits configured.{" "}
          <a href="/settings" className="text-md-primary font-semibold underline">
            Set up limits
          </a>{" "}
          to see your daily summary.
        </p>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {/* Hero Calorie Card */}
      <div className="md:col-span-2 hero-gradient rounded-[2rem] p-8 text-white shadow-[0_20px_40px_rgba(0,68,147,0.15)] relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                Daily Goal
              </span>
              <h3 className="text-5xl font-extrabold mt-4 tracking-tighter">
                {Math.round(totalCalories)}{" "}
                <span className="text-xl font-normal opacity-70">{totals[0]?.unit ?? "units"}</span>
              </h3>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
              <span className="text-sm font-bold">{Math.round(overallPct)}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-md-tertiary-fixed rounded-full liquid-inner-glow"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium opacity-80 uppercase tracking-widest">
              <span>Consumed: {Math.round(totalCalories)}</span>
              <span>Remaining: {Math.round(Math.max(0, totalLimit - totalCalories))}</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Macro Breakdown */}
      <div className="bg-md-surface-container-lowest rounded-[2rem] p-8 space-y-6">
        <h4 className="font-bold text-lg text-md-on-surface">Macros</h4>
        <div className="space-y-4">
          {macros.map((nutrient, i) => {
            const pct =
              nutrient.dailyLimit && nutrient.dailyLimit > 0
                ? Math.min((nutrient.total / nutrient.dailyLimit) * 100, 100)
                : 0;
            return (
              <div key={nutrient.nutrientId} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-md-outline">{nutrient.displayName}</span>
                  <span>
                    {Math.round(nutrient.total)}
                    {nutrient.unit} / {Math.round(nutrient.dailyLimit ?? 0)}
                    {nutrient.unit}
                  </span>
                </div>
                <div className="h-1.5 bg-md-surface-container-high rounded-full overflow-hidden">
                  <div
                    className={`h-full ${macroColors[i % macroColors.length]} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
