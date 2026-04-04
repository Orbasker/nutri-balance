"use client";

import { Skeleton } from "boneyard-js/react";

import { DashboardFixture } from "@/components/skeletons/dashboard-fixture";

export default function DashboardLoading() {
  return (
    <Skeleton
      name="dashboard"
      loading={true}
      fixture={<DashboardFixture />}
      animate="shimmer"
      fallback={
        <div className="px-6 max-w-screen-xl mx-auto space-y-8 animate-pulse">
          <div className="h-64 rounded-[2.5rem] bg-md-surface-container" />
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-lg bg-md-surface-container" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-3xl bg-md-surface-container" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <DashboardFixture />
    </Skeleton>
  );
}
