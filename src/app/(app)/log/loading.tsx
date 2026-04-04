"use client";

import { Skeleton } from "boneyard-js/react";

import { LogFixture } from "@/components/skeletons/log-fixture";

export default function LogLoading() {
  return (
    <Skeleton
      name="log"
      loading={true}
      fixture={<LogFixture />}
      animate="shimmer"
      fallback={
        <div className="px-6 max-w-screen-xl mx-auto animate-pulse space-y-8">
          <div className="h-16 w-64 rounded-lg bg-md-surface-container" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-md-surface-container" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-md-surface-container" />
            ))}
          </div>
        </div>
      }
    >
      <LogFixture />
    </Skeleton>
  );
}
