"use client";

import { Skeleton } from "boneyard-js/react";

import { FoodDetailFixture } from "@/components/skeletons/food-detail-fixture";

export default function FoodDetailLoading() {
  return (
    <Skeleton
      name="food-detail"
      loading={true}
      fixture={<FoodDetailFixture />}
      animate="shimmer"
      fallback={
        <div className="pb-32 px-6 max-w-2xl mx-auto space-y-10 animate-pulse">
          <div className="h-5 w-32 rounded bg-md-surface-container" />
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-md-surface-container" />
            <div className="h-12 w-80 rounded-lg bg-md-surface-container" />
            <div className="h-4 w-96 rounded bg-md-surface-container" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-md-surface-container" />
            ))}
          </div>
        </div>
      }
    >
      <FoodDetailFixture />
    </Skeleton>
  );
}
