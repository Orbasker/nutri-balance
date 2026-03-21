"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { searchFoods } from "@/app/(app)/search/actions";
import type { FoodSearchResult } from "@/types";

import { SearchResults } from "./search-results";

interface SearchInputProps {
  initialResults?: FoodSearchResult[];
}

export function SearchInput({ initialResults = [] }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>(initialResults);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchFoods(value);
        setResults(data);
        setHasSearched(true);
      });
    }, 300);
  }, []);

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-md-outline">search</span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-md-surface-container-lowest border-none py-5 pl-14 pr-6 rounded-2xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] focus:ring-2 focus:ring-md-primary/20 text-md-on-surface placeholder:text-md-outline transition-all duration-300 outline-none"
          placeholder="Search ingredients or dishes..."
        />
      </div>

      {/* Loading State */}
      {isPending && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3 text-md-on-surface-variant">
            <div className="w-5 h-5 border-2 border-md-primary/30 border-t-md-primary rounded-full animate-spin" />
            <span className="text-sm font-medium">Searching...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {!isPending && hasSearched && <SearchResults results={results} />}

      {/* Nutrient Wisdom (show when no search) */}
      {!hasSearched && !isPending && (
        <div className="bg-gradient-to-br from-md-primary to-md-primary-container p-6 rounded-3xl text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-2xl font-bold mb-2">Nutrient Wisdom</h4>
            <p className="text-md-primary-fixed-dim text-sm max-w-[70%] leading-relaxed">
              Adding a squeeze of lemon to your spinach helps your body absorb iron more
              efficiently.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span
              className="material-symbols-outlined !text-9xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              tips_and_updates
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
