"use client";

import { Skeleton } from "boneyard-js/react";

import { DashboardFixture } from "@/components/skeletons/dashboard-fixture";
import { FoodDetailFixture } from "@/components/skeletons/food-detail-fixture";
import { LogFixture } from "@/components/skeletons/log-fixture";
import { SearchFixture } from "@/components/skeletons/search-fixture";

/**
 * Dev-only page for boneyard-js skeleton capture.
 * Run: bun run dev && bun run bones:build
 */
export default function BonesCapturePage() {
  return (
    <div className="space-y-16 pb-32">
      <Skeleton name="dashboard" loading={false} fixture={<DashboardFixture />}>
        <DashboardFixture />
      </Skeleton>

      <hr className="border-md-outline-variant" />

      <Skeleton name="log" loading={false} fixture={<LogFixture />}>
        <LogFixture />
      </Skeleton>

      <hr className="border-md-outline-variant" />

      <Skeleton name="search" loading={false} fixture={<SearchFixture />}>
        <SearchFixture />
      </Skeleton>

      <hr className="border-md-outline-variant" />

      <Skeleton name="food-detail" loading={false} fixture={<FoodDetailFixture />}>
        <FoodDetailFixture />
      </Skeleton>
    </div>
  );
}
