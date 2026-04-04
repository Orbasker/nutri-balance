"use client";

export function LogFixture() {
  return (
    <div className="px-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <section className="mb-10 pt-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-md-outline uppercase tracking-widest text-[10px] font-bold mb-1">
              Timeline
            </p>
            <h2 className="font-extrabold text-3xl text-md-primary">Today</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-md-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-md-on-surface-variant">
                chevron_left
              </span>
            </button>
            <span className="text-sm font-semibold text-md-on-surface min-w-[100px] text-center">
              Apr 4, 2026
            </span>
            <button className="w-10 h-10 rounded-full bg-md-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-md-on-surface-variant">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["Sodium", "Potassium", "Vitamin K", "Oxalate"].map((name) => (
          <div key={name} className="bg-md-surface-container-lowest rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-md-on-surface-variant uppercase">{name}</p>
            <p className="text-lg font-bold text-md-on-surface">450mg</p>
            <div className="h-2 w-full bg-md-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-md-tertiary rounded-full" style={{ width: "45%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Meal Log */}
      <section className="space-y-8 mt-8">
        <h3 className="font-bold text-xl px-2">Meal Log</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-md-surface-container-lowest rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-md-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-md-primary">restaurant</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-md-on-surface truncate">Grilled Salmon</p>
                <p className="text-xs text-md-outline font-medium">Lunch &middot; 12:30</p>
              </div>
              <p className="font-bold text-md-on-surface text-sm shrink-0">200g</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
