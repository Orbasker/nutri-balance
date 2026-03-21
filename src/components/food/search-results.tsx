import type { FoodSearchResult } from "@/types";

import { FoodCard } from "./food-card";

interface SearchResultsProps {
  results: FoodSearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-md-surface-container-high flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-md-outline">search_off</span>
        </div>
        <p className="text-md-on-surface-variant">No foods found. Try a different search term.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex justify-between items-end">
        <h3 className="text-sm font-bold uppercase tracking-widest text-md-outline">
          Search Results
        </h3>
        <span className="text-xs font-semibold text-md-primary">
          {results.length} item{results.length !== 1 ? "s" : ""} found
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((food) => (
          <FoodCard key={food.id} food={food} />
        ))}
      </div>
    </section>
  );
}
