"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  /** Minimum display time in ms before allowing fade-out */
  minDisplayMs?: number;
  /** Called after the splash has fully faded out */
  onComplete?: () => void;
}

export function SplashScreen({ minDisplayMs = 1800, onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("fading"), minDisplayMs);
    return () => clearTimeout(timer);
  }, [minDisplayMs]);

  useEffect(() => {
    if (phase === "fading") {
      const timer = setTimeout(() => {
        setPhase("done");
        onComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Clinical gradient background */}
      <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] px-8 py-24">
        {/* Ambient blur elements (asymmetric) */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-md-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-md-secondary/5 blur-3xl" />

        {/* Dot pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(#004493 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Center Identity */}
        <div className="z-10 flex flex-grow flex-col items-center justify-center space-y-8">
          {/* Brand Logo */}
          <div className="group relative">
            <div className="absolute -inset-4 rounded-full bg-md-primary/10 blur-xl transition-all duration-700 group-hover:bg-md-primary/20" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-md-surface-container-lowest shadow-[0px_10px_30px_rgba(0,68,147,0.06)]">
              <span
                className="material-symbols-outlined text-5xl text-md-primary"
                style={{ fontVariationSettings: "'wght' 300" }}
              >
                bubble_chart
              </span>
            </div>
          </div>

          {/* Brand Typography */}
          <div className="space-y-3 text-center">
            <h1 className="font-heading text-5xl font-extrabold tracking-tighter text-md-on-primary-fixed-variant">
              Nutri Balance
            </h1>
            <p className="mx-auto max-w-[200px] text-sm font-medium leading-relaxed tracking-wide text-md-outline">
              Your Clinical Sanctuary for Nutrition
            </p>
          </div>
        </div>

        {/* Initialization Footer */}
        <div className="z-10 flex w-full max-w-xs flex-col items-center space-y-6">
          {/* Tonal Progress Bar */}
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-md-surface-container-high">
            <div className="absolute left-0 top-0 h-full w-1/3 rounded-full bg-md-primary" />
            <div className="splash-shimmer absolute left-[-40%] h-full w-[40%] bg-gradient-to-r from-transparent via-[rgba(0,68,147,0.2)] to-transparent" />
          </div>

          <div className="flex flex-col items-center space-y-1">
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-md-primary/60">
              Initializing System
            </span>
            <span className="font-label text-[10px] font-medium text-md-outline/50">
              v2.4.0 &bull; Secure Encryption Active
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
