"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { searchFoods } from "@/app/(app)/search/actions";
import type { FoodSearchResult } from "@/types";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

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
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search foods by name (e.g., spinach, chicken, rice)..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {isPending && <p className="text-center text-sm text-muted-foreground">Searching...</p>}

      {!isPending && hasSearched && <SearchResults results={results} />}
    </div>
  );
}
