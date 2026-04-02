import type { PaginatedSearchResult, SearchFilters } from "@/types";

import { FoodCard } from "./food-card";
import { SearchFiltersBar } from "./search-filters";
import { SearchPagination } from "./search-pagination";

interface SearchResultsProps {
  searchResult: PaginatedSearchResult;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onPageChange: (page: number) => void;
}

export function SearchResults({
  searchResult,
  filters,
  onFiltersChange,
  onPageChange,
}: SearchResultsProps) {
  const { results, totalCount, page, pageSize, totalPages, substanceName, availableCategories } =
    searchResult;

  if (totalCount === 0 && Object.values(filters).every((v) => !v)) {
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
          {substanceName ? `Foods with ${substanceName}` : "Search Results"}
        </h3>
        <span className="text-xs font-semibold text-md-primary">
          {totalCount} item{totalCount !== 1 ? "s" : ""} found
        </span>
      </div>
      {substanceName && (
        <p className="text-sm text-md-on-surface-variant -mt-3">
          Sorted by highest {substanceName} content per 100g
        </p>
      )}

      {/* Filters */}
      <SearchFiltersBar
        filters={filters}
        onChange={onFiltersChange}
        availableCategories={availableCategories}
      />

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((food) => (
            <FoodCard key={food.id} food={food} />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-md-on-surface-variant">
            No foods match the current filters. Try adjusting your filters.
          </p>
        </div>
      )}

      {/* Pagination */}
      <SearchPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </section>
  );
}
