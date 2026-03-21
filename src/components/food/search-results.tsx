import type { FoodSearchResult } from "@/types";

import { FoodCard } from "./food-card";

interface SearchResultsProps {
  results: FoodSearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No foods found. Try a different search term.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((food) => (
        <FoodCard key={food.id} food={food} />
      ))}
    </div>
  );
}
