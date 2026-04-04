"use client";

export function FoodDetailFixture() {
  return (
    <div className="pb-32 px-6 max-w-2xl mx-auto space-y-10">
      {/* Back Button */}
      <div className="inline-flex items-center gap-1 text-md-primary">
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="text-sm font-medium">Back to search</span>
      </div>

      {/* Hero */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-md-outline">
            <span className="text-xs uppercase tracking-widest font-semibold">Vegetables</span>
            <span className="w-1 h-1 rounded-full bg-md-outline-variant" />
          </div>
          <h2 className="text-4xl font-extrabold text-md-primary tracking-tight leading-tight">
            Grilled Chicken Breast
          </h2>
          <p className="text-md-on-surface-variant text-sm">
            Boneless skinless chicken breast, grilled without oil
          </p>
        </div>
      </section>

      {/* Substance Table */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-md-on-surface">Substance Profile</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-md-surface-container-lowest rounded-2xl p-4"
            >
              <div>
                <p className="font-semibold text-md-on-surface">Sodium</p>
                <p className="text-xs text-md-outline">per 100g</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-md-on-surface">74mg</p>
                <p className="text-xs text-md-outline">High confidence</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Log Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-md-on-surface">Log This Food</h3>
        <div className="bg-md-surface-container-lowest rounded-3xl p-6 space-y-4">
          <div className="h-14 rounded-2xl bg-md-surface-container-high" />
          <div className="h-14 rounded-2xl bg-md-surface-container-high" />
          <div className="h-12 rounded-2xl bg-md-primary" />
        </div>
      </section>
    </div>
  );
}
