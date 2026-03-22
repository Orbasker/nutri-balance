"use client";

import { useMemo, useState } from "react";

import type { FoodReviewItem } from "@/types";

import { FoodReviewCard } from "@/components/admin/food-review-card";

type FilterOption = "all" | "has_feedback";
type SortOption = "newest" | "most_pending" | "lowest_confidence";

export function FoodReviewGrid({ foods }: { foods: FoodReviewItem[] }) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const filteredAndSorted = useMemo(() => {
    let result = [...foods];

    // Filter
    if (filter === "has_feedback") {
      result = result.filter((f) => f.feedbackCount > 0);
    }

    // Sort
    switch (sort) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "most_pending":
        result.sort((a, b) => b.pendingObservationCount - a.pendingObservationCount);
        break;
      case "lowest_confidence":
        result.sort((a, b) => a.avgConfidence - b.avgConfidence);
        break;
    }

    return result;
  }, [foods, filter, sort]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fr-filter">
            Filter
          </label>
          <select
            id="fr-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="has_feedback">Has feedback</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fr-sort">
            Sort
          </label>
          <select
            id="fr-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="most_pending">Most pending</option>
            <option value="lowest_confidence">Lowest confidence</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredAndSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No foods pending review.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSorted.map((food) => (
            <FoodReviewCard key={food.id} food={food} />
          ))}
        </div>
      )}
    </div>
  );
}
