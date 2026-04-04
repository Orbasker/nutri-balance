"use client";

export function SearchFixture() {
  return (
    <div className="px-6 max-w-screen-xl mx-auto">
      <section className="mt-8 mb-12">
        <h2 className="text-3xl font-extrabold text-md-primary mb-2 tracking-tight">
          What are you eating?
        </h2>
        <p className="text-md-on-surface-variant font-medium">
          Search any food to check its substances against your limits.
        </p>
        <div className="mt-8">
          <div className="relative">
            <div className="w-full h-14 rounded-2xl bg-md-surface-container-highest border border-md-outline-variant" />
          </div>
        </div>
      </section>
    </div>
  );
}
