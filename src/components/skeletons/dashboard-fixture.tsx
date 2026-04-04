"use client";

export function DashboardFixture() {
  return (
    <div className="px-6 max-w-screen-xl mx-auto space-y-8">
      {/* Hero Summary */}
      <section className="substance-glass rounded-[2.5rem] p-8 text-white shadow-[0_20px_40px_rgba(0,68,147,0.15)] relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-lg font-semibold mb-0.5">Good afternoon, Alex</p>
          <p className="text-blue-100/70 text-sm font-medium mb-4">Manage sodium intake</p>
          <div className="flex items-center gap-6 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-300">All safe</span>
            </div>
            <span className="text-sm text-blue-100/60 font-medium">3 meals logged</span>
          </div>
          <p className="text-sm text-blue-100/80 mb-6 leading-relaxed max-w-md">
            Looking good so far. You have room for a full meal.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {["Sodium", "Potassium", "Vitamin K"].map((name) => (
              <div key={name} className="space-y-1">
                <p className="text-[10px] text-blue-100/60 font-semibold uppercase">{name}</p>
                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: "45%" }} />
                </div>
                <p className="text-xs font-bold">
                  450mg <span className="text-blue-100/40 font-medium">/ 1000mg</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracked Substances */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-2xl font-bold tracking-tight text-md-on-surface">
            Tracked Substances
          </h3>
          <span className="text-sm font-semibold text-md-primary">See details</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-md-surface-container-lowest p-6 rounded-3xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-md-on-surface-variant">Substance</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-md-on-surface">450mg</span>
                    <span className="text-xs font-medium text-md-outline">/ 1000mg</span>
                  </div>
                </div>
                <span className="bg-md-tertiary-fixed text-md-on-tertiary-fixed px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Safe
                </span>
              </div>
              <div className="h-3 w-full bg-md-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-md-tertiary rounded-full" style={{ width: "45%" }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Meals */}
      <section className="pb-8">
        <h3 className="text-2xl font-bold tracking-tight text-md-on-surface mb-6">Recent Meals</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 bg-md-surface-container-low p-4 rounded-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-md-primary">restaurant</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-md-on-surface truncate">Grilled Chicken Breast</p>
                <p className="text-xs text-md-outline font-medium">Lunch &middot; 12:30</p>
              </div>
              <p className="font-bold text-md-on-surface text-sm shrink-0">150g</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
