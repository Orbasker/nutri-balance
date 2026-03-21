"use client";

interface MissingFoodFlowProps {
  onReturnToSearch: () => void;
}

export function MissingFoodFlow({ onReturnToSearch }: MissingFoodFlowProps) {
  return (
    <div className="max-w-screen-md mx-auto">
      {/* Search Status Hero */}
      <section className="mb-12 text-center">
        <div className="mb-8 flex justify-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border-4 border-md-primary-container/20 border-t-md-primary animate-spin"
              style={{ animationDuration: "3s" }}
            />
            <div
              className="absolute inset-2 rounded-full border-2 border-md-secondary/10 border-b-md-secondary animate-spin"
              style={{ animationDuration: "2s", animationDirection: "reverse" }}
            />
            <span
              className="material-symbols-outlined text-5xl text-md-primary"
              style={{ fontVariationSettings: "'wght' 100" }}
            >
              database_search
            </span>
          </div>
        </div>
        <h2 className="font-extrabold text-3xl text-md-on-surface mb-3 tracking-tight">
          We&apos;re finding this for you
        </h2>
        <p className="text-md-on-surface-variant max-w-sm mx-auto font-medium leading-relaxed">
          Our clinical database is analyzing your query to provide high-precision nutritional data.
        </p>
      </section>

      {/* Bento Layout: Active Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {/* Verification Status Card */}
        <div className="p-6 rounded-3xl bg-md-surface-container-low flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-md-outline font-bold">
              Protocol Status
            </span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
              <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
              <span className="w-1.5 h-1.5 rounded-full bg-md-outline-variant" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">Data is being verified</h3>
            <p className="text-sm text-md-on-surface-variant">
              Cross-referencing with USDA and clinical food markers for accuracy.
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full bg-md-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-md-primary rounded-full w-2/3 liquid-inner-glow" />
          </div>
        </div>

        {/* Trust Badge Card */}
        <div className="p-6 rounded-3xl bg-md-surface-container-lowest flex flex-col justify-between">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-md-tertiary-fixed rounded-2xl">
              <span className="material-symbols-outlined text-md-on-tertiary-fixed-variant">
                verified_user
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm">Clinical Sanctuary</h4>
              <p className="text-xs text-md-on-surface-variant">
                Verified nutritional datasets only.
              </p>
            </div>
          </div>
          <div className="mt-4 flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-md-surface-container-lowest bg-md-surface-variant flex items-center justify-center text-[10px] font-bold">
              RD
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-md-surface-container-lowest bg-md-surface-variant flex items-center justify-center text-[10px] font-bold">
              MD
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-md-surface-container-lowest bg-md-surface-variant flex items-center justify-center text-[10px] font-bold">
              AI
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="space-y-4">
        <div className="p-8 rounded-[2.5rem] hero-gradient text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="text-center md:text-left">
              <h3 className="font-bold text-xl mb-2">Can&apos;t wait for verification?</h3>
              <p className="text-md-on-primary-container text-sm max-w-xs">
                If you have the packaging or specific data, you can log it manually now.
              </p>
            </div>
            <button className="bg-white text-md-primary font-bold px-8 py-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-xl">edit_note</span>
              Submit Data Manually
            </button>
          </div>
        </div>
        <div className="text-center py-4">
          <button
            onClick={onReturnToSearch}
            className="text-md-primary font-semibold text-sm hover:underline underline-offset-4 flex items-center justify-center gap-2 mx-auto"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Return to Search
          </button>
        </div>
      </section>

      {/* Why Verify Section */}
      <section className="mt-16 border-t border-md-outline-variant/10 pt-10">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="w-full md:w-1/3">
            <div className="w-full h-48 rounded-[2rem] bg-md-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-md-outline opacity-40">
                science
              </span>
            </div>
          </div>
          <div className="w-full md:w-2/3">
            <h4 className="font-bold text-xl mb-3">Why verify?</h4>
            <p className="text-md-on-surface-variant leading-relaxed text-sm">
              Standard databases often contain user-submitted errors. Our &ldquo;Sanctuary&rdquo;
              protocol ensures that every calorie and macronutrient logged contributes to
              medical-grade tracking accuracy.
            </p>
            <div className="mt-4 flex gap-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-md-primary text-sm">
                  check_circle
                </span>
                <span className="text-xs font-bold text-md-on-surface">Lab Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-md-primary text-sm">
                  check_circle
                </span>
                <span className="text-xs font-bold text-md-on-surface">99% Accuracy</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
