"use client";

import { useState, useSyncExternalStore } from "react";

import { SplashScreen } from "@/components/splash-screen";

const SPLASH_KEY = "nutri-balance-splash-shown";
const emptySubscribe = () => () => {};

export function AppShell({ children }: { children: React.ReactNode }) {
  const splashNeeded = useSyncExternalStore(
    emptySubscribe,
    () => !sessionStorage.getItem(SPLASH_KEY),
    () => false,
  );
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
