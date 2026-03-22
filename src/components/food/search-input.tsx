"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  type PdfUploadResult,
  aiDiscoverFoodsByNutrient,
  aiSearchFood,
  searchFoods,
  uploadNutrientPdf,
} from "@/app/(app)/search/actions";
import type { PaginatedSearchResult, SearchFilters } from "@/types";

import { SearchResults } from "./search-results";

const PAGE_SIZE = 20;

export function SearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PaginatedSearchResult | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback((q: string, f: SearchFilters, page: number) => {
    startTransition(async () => {
      const data = await searchFoods(q, f, { page, pageSize: PAGE_SIZE });
      setSearchResult(data);
      setHasSearched(true);
    });
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      setAiError(null);
      setAiSuccess(null);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length < 2) {
        setSearchResult(null);
        setHasSearched(false);
        setFilters({});
        return;
      }

      // Reset filters and page on new query
      setFilters({});

      debounceRef.current = setTimeout(() => {
        executeSearch(value, {}, 1);
      }, 300);
    },
    [executeSearch],
  );

  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (query.trim().length >= 2) {
        executeSearch(query, newFilters, 1);
      }
    },
    [query, executeSearch],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (query.trim().length >= 2) {
        executeSearch(query, filters, page);
      }
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [query, filters, executeSearch],
  );

  // AI agent: research a single food not in DB
  const handleAiFoodSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsAiSearching(true);
    setAiError(null);

    try {
      const result = await aiSearchFood(query);
      if (result.status === "found") {
        router.push(`/food/${result.foodId}`);
      } else {
        setAiError(result.message);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
    } finally {
      setIsAiSearching(false);
    }
  }, [query, router]);

  // AI agent: discover more foods for a nutrient (now uses USDA API + AI)
  const handleAiNutrientSearch = useCallback(async () => {
    if (!searchResult?.nutrientId) return;
    setIsAiSearching(true);
    setAiError(null);

    try {
      const result = await aiDiscoverFoodsByNutrient(searchResult.nutrientId);
      if (result.status === "found") {
        setAiSuccess(result.summary);
        // Re-run the search to show the new foods
        executeSearch(query, filters, 1);
        setIsAiSearching(false);
      } else {
        setAiError(result.message);
        setIsAiSearching(false);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
      setIsAiSearching(false);
    }
  }, [searchResult?.nutrientId, query, filters, executeSearch]);

  // PDF upload handler
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setShowUpload(false);
      setUploadStatus("Uploading PDF...");
      setAiError(null);
      setAiSuccess(null);

      // Progress simulation — updates status based on elapsed time
      const steps = [
        { delay: 2000, msg: "Analyzing document structure..." },
        { delay: 6000, msg: "Extracting food entries (page 1)..." },
        { delay: 15000, msg: "Extracting food entries (processing pages)..." },
        { delay: 30000, msg: "Still extracting — large document..." },
        { delay: 50000, msg: "Inserting foods into database..." },
        { delay: 80000, msg: "Almost done — finalizing..." },
      ];
      const timers = steps.map((s) => setTimeout(() => setUploadStatus(s.msg), s.delay));

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result: PdfUploadResult = await uploadNutrientPdf(formData);
        timers.forEach(clearTimeout);

        if (result.status === "success") {
          const msg = [
            `Imported ${result.count} food${result.count !== 1 ? "s" : ""} from PDF`,
            result.skipped > 0 ? ` (${result.skipped} skipped — already in DB)` : "",
            " — pending admin review",
          ].join("");
          setAiSuccess(msg);

          // Re-run current search to show new results
          if (query.trim().length >= 2) {
            executeSearch(query, filters, 1);
          }
        } else {
          setAiError(result.message);
        }
      } catch {
        timers.forEach(clearTimeout);
        setAiError("Failed to upload PDF. Please try again.");
      } finally {
        setIsUploading(false);
        setShowUpload(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [query, filters, executeSearch],
  );

  const isNutrientSearch = searchResult?.searchType === "nutrient";
  const hasQuery = query.trim().length >= 2;
  const showResults =
    !isPending && !isAiSearching && hasSearched && searchResult && searchResult.totalCount > 0;
  const showFilteredEmpty =
    !isPending &&
    !isAiSearching &&
    hasSearched &&
    searchResult &&
    searchResult.totalCount === 0 &&
    Object.values(filters).some(Boolean);

  return (
    <div className="space-y-8">
      {/* Hidden file input — always in DOM so labels can trigger it */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
        id="pdf-upload"
      />

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-md-outline">search</span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-md-surface-container-lowest border-none py-5 pl-14 pr-28 rounded-2xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] focus:ring-2 focus:ring-md-primary/20 text-md-on-surface placeholder:text-md-outline transition-all duration-300 outline-none"
          placeholder="Search foods, ingredients, or nutrients..."
        />
        <div className="absolute inset-y-0 right-4 flex items-center gap-1">
          {/* AI Research button — always visible when there's a query */}
          {hasQuery && (
            <button
              onClick={handleAiFoodSearch}
              disabled={isAiSearching}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-md-primary hover:bg-md-primary/10 transition-colors disabled:opacity-50"
              title={`AI research "${query}"`}
            >
              <span className="material-symbols-outlined text-[22px]">neurology</span>
            </button>
          )}
          {/* Upload PDF button */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-md-outline hover:text-md-primary hover:bg-md-primary/10 transition-colors"
            title="Import foods from PDF"
          >
            <span className="material-symbols-outlined text-[22px]">upload_file</span>
          </button>
        </div>
      </div>

      {/* PDF Upload Panel */}
      {showUpload && (
        <div className="bg-gradient-to-br from-md-secondary/5 to-md-tertiary/5 border border-md-secondary/20 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-md-secondary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-md-secondary">description</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-md-on-surface mb-1">Import from PDF</h4>
              <p className="text-sm text-md-on-surface-variant mb-4">
                Upload a USDA nutrient report or any PDF with food nutrient data. The AI will
                extract all food entries and add them to the database — often hundreds of foods from
                a single document.
              </p>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="pdf-upload"
                  className="inline-flex items-center gap-2 bg-md-secondary text-white font-bold py-2.5 px-5 rounded-xl cursor-pointer hover:bg-md-secondary/90 active:scale-95 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  Choose PDF
                </label>
                <span className="text-xs text-md-outline">Max 20MB</span>
              </div>

              <p className="text-xs text-md-outline mt-3">
                Tip: Search Google for &ldquo;USDA nutrient database [nutrient name] PDF&rdquo; to
                find comprehensive reports with hundreds of foods.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom progress toast for PDF upload */}
      {isUploading && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-md-surface-container-lowest border border-md-secondary/30 rounded-2xl px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-md-secondary/30 border-t-md-secondary rounded-full animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-md-on-surface">Importing PDF</p>
              <p className="text-xs text-md-on-surface-variant truncate">{uploadStatus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isPending && !isAiSearching && !isUploading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3 text-md-on-surface-variant">
            <div className="w-5 h-5 border-2 border-md-primary/30 border-t-md-primary rounded-full animate-spin" />
            <span className="text-sm font-medium">Searching...</span>
          </div>
        </div>
      )}

      {/* AI Searching State */}
      {isAiSearching && (
        <div className="text-center py-12">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-md-primary to-md-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-white animate-pulse">neurology</span>
            </div>
            <div>
              <p className="text-md-on-surface font-bold">AI Agent Researching</p>
              <p className="text-md-on-surface-variant text-sm mt-1">
                {isNutrientSearch
                  ? `Searching USDA database + AI for ${searchResult?.nutrientName} foods...`
                  : `Looking up nutrient data for \u201c${query}\u201d...`}
              </p>
              {isNutrientSearch && (
                <p className="text-md-outline text-xs mt-2">
                  Fetching from USDA FoodData Central API — this may add 30-50+ foods
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success banner */}
      {aiSuccess && !isPending && !isAiSearching && (
        <div className="flex items-center gap-3 bg-md-tertiary-fixed/30 border border-md-tertiary/20 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-md-tertiary text-[20px]">
            check_circle
          </span>
          <p className="text-sm font-medium text-md-on-surface">{aiSuccess}</p>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <>
          <SearchResults
            searchResult={searchResult}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onPageChange={handlePageChange}
          />

          {/* AI discover more for nutrient searches */}
          {isNutrientSearch && searchResult?.nutrientId && (
            <div className="flex flex-col items-center gap-3">
              {aiError && (
                <p className="text-md-error text-sm" role="alert">
                  {aiError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAiNutrientSearch}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-md-primary/10 to-md-tertiary/10 border border-md-primary/20 text-md-primary font-bold py-3 px-6 rounded-xl hover:from-md-primary/15 hover:to-md-tertiary/15 active:scale-95 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-[20px]">neurology</span>
                  Discover more {searchResult.nutrientName} foods (USDA + AI)
                </button>
                <label
                  htmlFor="pdf-upload"
                  className="inline-flex items-center gap-2 bg-md-secondary/10 border border-md-secondary/20 text-md-secondary font-bold py-3 px-5 rounded-xl hover:bg-md-secondary/15 active:scale-95 transition-all duration-200 cursor-pointer"
                  title="Upload a USDA PDF for bulk import"
                >
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                  Import PDF
                </label>
              </div>
            </div>
          )}

          {/* AI research prompt — always visible below results for food searches */}
          {!isNutrientSearch && (
            <AiResearchPrompt query={query} onResearch={handleAiFoodSearch} aiError={aiError} />
          )}
        </>
      )}

      {/* Show filters with no-match message when filters produce 0 results but query has matches */}
      {showFilteredEmpty && (
        <SearchResults
          searchResult={searchResult}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onPageChange={handlePageChange}
        />
      )}

      {/* Error display */}
      {aiError && !isNutrientSearch && !isAiSearching && !showResults && (
        <div className="flex items-center gap-3 bg-md-error/10 border border-md-error/20 rounded-xl px-5 py-3">
          <span className="material-symbols-outlined text-md-error text-[20px]">error</span>
          <p className="text-sm font-medium text-md-error">{aiError}</p>
        </div>
      )}

      {/* No Results — full AI option panel */}
      {!isAiSearching &&
        !isPending &&
        hasSearched &&
        searchResult?.totalCount === 0 &&
        hasQuery &&
        !isNutrientSearch &&
        Object.values(filters).every((v) => !v) && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-md-surface-container-high flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-md-outline">search_off</span>
            </div>
            <div>
              <p className="text-md-on-surface-variant">
                No foods found in our database for &ldquo;{query}&rdquo;.
              </p>
            </div>

            <div className="bg-gradient-to-br from-md-primary/5 to-md-tertiary/5 border border-md-primary/15 rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex items-center gap-3 justify-center mb-3">
                <span className="material-symbols-outlined text-md-primary">neurology</span>
                <h4 className="font-bold text-md-on-surface">Ask AI Agent</h4>
              </div>
              <p className="text-sm text-md-on-surface-variant mb-4">
                Our AI agent can research nutrient data for this food from USDA FoodData Central and
                nutrition literature.
              </p>
              <button
                onClick={handleAiFoodSearch}
                className="bg-md-primary text-white font-bold py-3 px-8 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90"
              >
                Research &ldquo;{query}&rdquo;
              </button>
            </div>
          </div>
        )}

      {/* Nutrient Wisdom (show when no search) */}
      {!hasSearched && !isPending && !isAiSearching && !showUpload && (
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

/**
 * Compact AI research prompt shown below search results.
 * Lets users trigger AI food research even when DB results exist.
 */
function AiResearchPrompt({
  query,
  onResearch,
  aiError,
}: {
  query: string;
  onResearch: () => void;
  aiError: string | null;
}) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-md-primary/5 to-md-tertiary/5 border border-md-primary/10 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-md-primary text-[20px]">neurology</span>
        <p className="text-sm text-md-on-surface-variant">Can&apos;t find what you need?</p>
      </div>
      <div className="flex items-center gap-3">
        {aiError && <p className="text-xs text-md-error">{aiError}</p>}
        <button
          onClick={onResearch}
          className="inline-flex items-center gap-2 bg-md-primary text-white font-bold py-2 px-5 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90 text-sm"
        >
          AI Research &ldquo;{query}&rdquo;
        </button>
      </div>
    </div>
  );
}
