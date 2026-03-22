"use client";

import { useState } from "react";

import { SplashScreen } from "@/components/splash-screen";

const SPLASH_KEY = "nutri-balance-splash-shown";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [splashNeeded] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(SPLASH_KEY);
  });
  const [splashDone, setSplashDone] = useState(false);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setSplashDone(true);
  };

  const showSplash = splashNeeded && !splashDone;

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {children}
    </>
  );
}
