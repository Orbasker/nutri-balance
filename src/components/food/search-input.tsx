"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import {
  type PdfUploadResult,
  aiDiscoverFoodsByNutrient,
  aiSearchFood,
  listNutrients,
  searchByNutrientId,
  searchFoods,
  uploadNutrientPdf,
} from "@/app/(app)/search/actions";
import type { NutrientOption, PaginatedSearchResult, SearchFilters } from "@/types";

import { cn } from "@/lib/utils";

import { NutrientPicker } from "./nutrient-picker";
import { SearchResults } from "./search-results";

const PAGE_SIZE = 20;

type SearchMode = "food" | "nutrient";

export function SearchInput() {
  // -- Shared state --
  const [mode, setMode] = useState<SearchMode>("food");
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

  // -- Food search state --
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Nutrient search state --
  const [nutrientsList, setNutrientsList] = useState<NutrientOption[]>([]);
  const [nutrientsLoading, setNutrientsLoading] = useState(false);
  const [nutrientsLoaded, setNutrientsLoaded] = useState(false);
  const [selectedNutrient, setSelectedNutrient] = useState<NutrientOption | null>(null);

  // -- Mode switching --
  const handleModeSwitch = useCallback(
    (newMode: SearchMode) => {
      if (newMode === mode) return;
      setMode(newMode);
      // Clear all search state
      setQuery("");
      setSearchResult(null);
      setHasSearched(false);
      setFilters({});
      setAiError(null);
      setAiSuccess(null);
      setSelectedNutrient(null);
      setShowUpload(false);

      // Load nutrients on first switch to nutrient mode
      if (newMode === "nutrient" && !nutrientsLoaded) {
        setNutrientsLoading(true);
        listNutrients()
          .then((data) => {
            setNutrientsList(data);
            setNutrientsLoaded(true);
          })
          .catch(() => {
            setAiError("Failed to load nutrients.");
          })
          .finally(() => setNutrientsLoading(false));
      }
    },
    [mode, nutrientsLoaded],
  );

  // -- Food search handlers (existing behavior preserved) --
  const executeFoodSearch = useCallback((q: string, f: SearchFilters, page: number) => {
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

      setFilters({});

      debounceRef.current = setTimeout(() => {
        executeFoodSearch(value, {}, 1);
      }, 300);
    },
    [executeFoodSearch],
  );

  // -- Nutrient search handlers --
  const executeNutrientSearch = useCallback(
    (nutrientId: string, f: SearchFilters, page: number) => {
      startTransition(async () => {
        const data = await searchByNutrientId(nutrientId, f, { page, pageSize: PAGE_SIZE });
        setSearchResult(data);
        setHasSearched(true);
      });
    },
    [],
  );

  const handleNutrientSelect = useCallback(
    (nutrient: NutrientOption) => {
      setSelectedNutrient(nutrient);
      setAiError(null);
      setAiSuccess(null);
      setFilters({});
      executeNutrientSearch(nutrient.id, {}, 1);
    },
    [executeNutrientSearch],
  );

  const handleNutrientClear = useCallback(() => {
    setSelectedNutrient(null);
    setSearchResult(null);
    setHasSearched(false);
    setFilters({});
    setAiError(null);
    setAiSuccess(null);
  }, []);

  // -- Shared handlers --
  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (mode === "food" && query.trim().length >= 2) {
        executeFoodSearch(query, newFilters, 1);
      } else if (mode === "nutrient" && selectedNutrient) {
        executeNutrientSearch(selectedNutrient.id, newFilters, 1);
      }
    },
    [mode, query, selectedNutrient, executeFoodSearch, executeNutrientSearch],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (mode === "food" && query.trim().length >= 2) {
        executeFoodSearch(query, filters, page);
      } else if (mode === "nutrient" && selectedNutrient) {
        executeNutrientSearch(selectedNutrient.id, filters, page);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [mode, query, selectedNutrient, filters, executeFoodSearch, executeNutrientSearch],
  );

  // AI agent: research a food not in DB
  const handleAiFoodSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsAiSearching(true);
    setAiError(null);

    try {
      const result = await aiSearchFood(query);
      if (result.status === "found") {
        setAiSuccess(`Added "${query}" with nutrient data - pending admin review`);
        executeFoodSearch(query, filters, 1);
      } else {
        setAiError(result.message);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
    } finally {
      setIsAiSearching(false);
    }
  }, [query, filters, executeFoodSearch]);

  // AI agent: discover more foods for a nutrient
  const handleAiNutrientSearch = useCallback(async () => {
    const nutrientId = selectedNutrient?.id ?? searchResult?.nutrientId;
    if (!nutrientId) return;
    setIsAiSearching(true);
    setAiError(null);

    try {
      const result = await aiDiscoverFoodsByNutrient(nutrientId);
      if (result.status === "found") {
        setAiSuccess(result.summary);
        if (selectedNutrient) {
          executeNutrientSearch(selectedNutrient.id, filters, 1);
        } else if (query.trim().length >= 2) {
          executeFoodSearch(query, filters, 1);
        }
      } else {
        setAiError(result.message);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
    } finally {
      setIsAiSearching(false);
    }
  }, [
    selectedNutrient,
    searchResult?.nutrientId,
    query,
    filters,
    executeFoodSearch,
    executeNutrientSearch,
  ]);

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

      const steps = [
        { delay: 2000, msg: "Analyzing document structure..." },
        { delay: 6000, msg: "Extracting food entries (page 1)..." },
        { delay: 15000, msg: "Extracting food entries (processing pages)..." },
        { delay: 30000, msg: "Still extracting - large document..." },
        { delay: 50000, msg: "Inserting foods into database..." },
        { delay: 80000, msg: "Almost done - finalizing..." },
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
            result.skipped > 0 ? ` (${result.skipped} skipped - already in DB)` : "",
            " - pending admin review",
          ].join("");
          setAiSuccess(msg);

          if (mode === "food" && query.trim().length >= 2) {
            executeFoodSearch(query, filters, 1);
          } else if (mode === "nutrient" && selectedNutrient) {
            executeNutrientSearch(selectedNutrient.id, filters, 1);
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
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [mode, query, selectedNutrient, filters, executeFoodSearch, executeNutrientSearch],
  );

  const isNutrientSearch = mode === "nutrient" || searchResult?.searchType === "nutrient";
  const hasQuery = mode === "food" ? query.trim().length >= 2 : !!selectedNutrient;

  // Smart AI action
  const handleAiAction = useCallback(async () => {
    if (isNutrientSearch) {
      await handleAiNutrientSearch();
    } else {
      await handleAiFoodSearch();
    }
  }, [isNutrientSearch, handleAiNutrientSearch, handleAiFoodSearch]);

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
        id="pdf-upload"
      />

      {/* Mode Toggle */}
      <div className="flex gap-2 bg-md-surface-container rounded-2xl p-1.5">
        <button
          onClick={() => handleModeSwitch("food")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200",
            mode === "food"
              ? "bg-md-primary text-white shadow-md"
              : "text-md-on-surface-variant hover:bg-md-surface-container-high",
          )}
        >
          <span className="material-symbols-outlined text-[20px]">search</span>
          Search Food
        </button>
        <button
          onClick={() => handleModeSwitch("nutrient")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200",
            mode === "nutrient"
              ? "bg-md-primary text-white shadow-md"
              : "text-md-on-surface-variant hover:bg-md-surface-container-high",
          )}
        >
          <span className="material-symbols-outlined text-[20px]">science</span>
          Search Nutrient
        </button>
      </div>

      {/* Food Search Input */}
      {mode === "food" && (
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
            {hasQuery && (
              <button
                onClick={handleAiAction}
                disabled={isAiSearching}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-md-primary hover:bg-md-primary/10 transition-colors disabled:opacity-50"
                title={
                  isNutrientSearch
                    ? `Discover more ${searchResult?.nutrientName} foods (USDA + AI)`
                    : `AI research "${query}"`
                }
              >
                <span className="material-symbols-outlined text-[22px]">neurology</span>
              </button>
            )}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-md-outline hover:text-md-primary hover:bg-md-primary/10 transition-colors"
              title="Import foods from PDF"
            >
              <span className="material-symbols-outlined text-[22px]">upload_file</span>
            </button>
          </div>
        </div>
      )}

      {/* Nutrient Search Picker */}
      {mode === "nutrient" && (
        <div className="space-y-4">
          <NutrientPicker
            nutrients={nutrientsList}
            isLoading={nutrientsLoading}
            selectedNutrient={selectedNutrient}
            onSelect={handleNutrientSelect}
            onClear={handleNutrientClear}
          />
          {/* AI Discover button for nutrient mode */}
          {selectedNutrient && !isAiSearching && (
            <button
              onClick={handleAiNutrientSearch}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-md-primary/5 to-md-tertiary/5 border border-md-primary/15 rounded-2xl py-4 px-6 text-md-primary font-bold hover:from-md-primary/10 hover:to-md-tertiary/10 active:scale-[0.99] transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[22px]">neurology</span>
              Discover more foods with AI (USDA + research)
            </button>
          )}
        </div>
      )}

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
                extract all food entries and add them to the database - often hundreds of foods from
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
                  ? `Searching USDA database + AI for ${selectedNutrient?.displayName ?? searchResult?.nutrientName} foods...`
                  : `Looking up nutrient data for \u201c${query}\u201d...`}
              </p>
              {isNutrientSearch && (
                <p className="text-md-outline text-xs mt-2">
                  Fetching from USDA FoodData Central API - this may add 30-50+ foods
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

          {/* AI research prompt - always visible below results */}
          {!isNutrientSearch && (
            <AiResearchPrompt query={query} onResearch={handleAiFoodSearch} aiError={aiError} />
          )}
          {isNutrientSearch && (searchResult?.nutrientId || selectedNutrient) && (
            <AiResearchPrompt
              query={selectedNutrient?.displayName ?? searchResult?.nutrientName ?? query}
              onResearch={handleAiNutrientSearch}
              aiError={aiError}
              isNutrient
            />
          )}
        </>
      )}

      {/* Show filters with no-match message when filters produce 0 results */}
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

      {/* No Results - full AI option panel (food mode only) */}
      {!isAiSearching &&
        !isPending &&
        hasSearched &&
        searchResult?.totalCount === 0 &&
        hasQuery &&
        mode === "food" &&
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

      {/* No Results - nutrient mode empty state */}
      {!isAiSearching &&
        !isPending &&
        hasSearched &&
        searchResult?.totalCount === 0 &&
        mode === "nutrient" &&
        selectedNutrient &&
        Object.values(filters).every((v) => !v) && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-md-surface-container-high flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-md-outline">science</span>
            </div>
            <div>
              <p className="text-md-on-surface-variant">
                No foods with {selectedNutrient.displayName} data in our database yet.
              </p>
            </div>

            <div className="bg-gradient-to-br from-md-primary/5 to-md-tertiary/5 border border-md-primary/15 rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex items-center gap-3 justify-center mb-3">
                <span className="material-symbols-outlined text-md-primary">neurology</span>
                <h4 className="font-bold text-md-on-surface">Discover with AI</h4>
              </div>
              <p className="text-sm text-md-on-surface-variant mb-4">
                Our AI agent will search USDA FoodData Central and nutrition research to find foods
                rich in {selectedNutrient.displayName}.
              </p>
              <button
                onClick={handleAiNutrientSearch}
                className="bg-md-primary text-white font-bold py-3 px-8 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90"
              >
                Discover {selectedNutrient.displayName} foods
              </button>
            </div>
          </div>
        )}

      {/* Nutrient Wisdom (show when no search in food mode) */}
      {mode === "food" && !hasSearched && !isPending && !isAiSearching && !showUpload && (
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

      {/* Nutrient mode welcome (show when no nutrient selected) */}
      {mode === "nutrient" && !selectedNutrient && !isPending && !isAiSearching && (
        <div className="bg-gradient-to-br from-md-tertiary to-md-tertiary-container p-6 rounded-3xl text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-2xl font-bold mb-2">Nutrient Explorer</h4>
            <p className="text-md-tertiary-fixed-dim text-sm max-w-[70%] leading-relaxed">
              Select a nutrient above to discover which foods contain the highest amounts. Great for
              targeted dietary planning.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <span
              className="material-symbols-outlined !text-9xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              science
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact AI research prompt shown below search results.
 */
function AiResearchPrompt({
  query,
  onResearch,
  aiError,
  isNutrient,
}: {
  query: string;
  onResearch: () => void;
  aiError: string | null;
  isNutrient?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-md-primary/5 to-md-tertiary/5 border border-md-primary/10 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-md-primary text-[20px]">neurology</span>
        <p className="text-sm text-md-on-surface-variant">
          {isNutrient ? "Want more foods?" : "Can\u0027t find what you need?"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {aiError && <p className="text-xs text-md-error">{aiError}</p>}
        <button
          onClick={onResearch}
          className="inline-flex items-center gap-2 bg-md-primary text-white font-bold py-2 px-5 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90 text-sm"
        >
          {isNutrient
            ? `Discover more ${query} foods (USDA + AI)`
            : `AI Research \u201c${query}\u201d`}
        </button>
      </div>
    </div>
  );
}
