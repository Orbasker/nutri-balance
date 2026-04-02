"use client";

import { useEffect, useState } from "react";

import { AiResearchTrackerProvider } from "@/components/food/ai-research-tracker-provider";
import { SplashScreen } from "@/components/splash-screen";

const SPLASH_KEY = "nutri-balance-splash-shown";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [splashNeeded, setSplashNeeded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) return;
    queueMicrotask(() => {
      setSplashNeeded(true);
    });
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setSplashDone(true);
  };

  const showSplash = splashNeeded && !splashDone;

  return (
    <AiResearchTrackerProvider>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {children}
    </AiResearchTrackerProvider>
  );
}
