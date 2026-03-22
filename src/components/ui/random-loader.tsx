"use client";

import { useEffect, useReducer } from "react";

import { GhostLoader } from "@/components/ui/ghost-loader";
import { KiwiLoader } from "@/components/ui/kiwi-loader";

const loaders = [KiwiLoader, GhostLoader] as const;

function pickRandom() {
  return loaders[Math.floor(Math.random() * loaders.length)];
}

export function RandomLoader() {
  const [LoaderComponent, pick] = useReducer(
    pickRandom,
    null as unknown as (typeof loaders)[number],
  );

  useEffect(() => {
    pick();
  }, []);

  if (!LoaderComponent) return null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoaderComponent />
    </div>
  );
}
