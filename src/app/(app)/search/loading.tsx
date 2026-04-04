"use client";

import { Skeleton } from "boneyard-js/react";

import { SearchFixture } from "@/components/skeletons/search-fixture";

export default function SearchLoading() {
  return (
    <Skeleton
      name="search"
      loading={true}
      fixture={<SearchFixture />}
      animate="shimmer"
      fallback={
        <div className="px-6 max-w-screen-xl mx-auto animate-pulse">
          <div className="mt-8 mb-12 space-y-4">
            <div className="h-10 w-80 rounded-lg bg-md-surface-container" />
            <div className="h-5 w-96 rounded bg-md-surface-container" />
            <div className="mt-8 h-14 rounded-2xl bg-md-surface-container" />
          </div>
        </div>
      }
    >
      <SearchFixture />
    </Skeleton>
  );
}
