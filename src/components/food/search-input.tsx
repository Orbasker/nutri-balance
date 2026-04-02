"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import {
  type PdfUploadResult,
  aiDiscoverFoodsBySubstance,
  aiSearchFood,
  listSubstances,
  resolveSubstanceSearchTerm,
  searchBySubstanceId,
  searchFoods,
  uploadSubstancePdf,
} from "@/app/(app)/search/actions";
import type { PaginatedSearchResult, SearchFilters, SubstanceOption } from "@/types";

import { cn } from "@/lib/utils";

import { useAiResearchTracker } from "./ai-research-tracker-provider";
import { SearchResults } from "./search-results";
import { SubstancePicker } from "./substance-picker";

const PAGE_SIZE = 20;

type SearchMode = "food" | "substance";

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

  // Floating tracker state
  const { researchTracker, setResearchTracker, resetResearchTracker } = useAiResearchTracker();

  // -- Food search state --
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Substance search state --
  const [substancesList, setSubstancesList] = useState<SubstanceOption[]>([]);
  const [substancesLoading, setSubstancesLoading] = useState(false);
  const [substancesLoaded, setSubstancesLoaded] = useState(false);
  const [selectedSubstance, setSelectedSubstance] = useState<SubstanceOption | null>(null);

  const addSubstanceOption = useCallback((substance: SubstanceOption) => {
    setSubstancesList((prev) => {
      if (prev.some((item) => item.id === substance.id)) {
        return prev;
      }

      return [...prev, substance].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });
  }, []);

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
      setSelectedSubstance(null);
      setShowUpload(false);
      resetResearchTracker();

      // Load substances on first switch to substance mode
      if (newMode === "substance" && !substancesLoaded) {
        setSubstancesLoading(true);
        listSubstances()
          .then((data) => {
            setSubstancesList(data);
            setSubstancesLoaded(true);
          })
          .catch(() => {
            setAiError("Failed to load substances.");
          })
          .finally(() => setSubstancesLoading(false));
      }
    },
    [mode, resetResearchTracker, substancesLoaded],
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

  // -- Substance search handlers --
  const executeSubstanceSearch = useCallback(
    (substanceId: string, f: SearchFilters, page: number) => {
      startTransition(async () => {
        const data = await searchBySubstanceId(substanceId, f, { page, pageSize: PAGE_SIZE });
        setSearchResult(data);
        setHasSearched(true);
      });
    },
    [],
  );

  const handleSubstanceSelect = useCallback(
    (substance: SubstanceOption) => {
      setSelectedSubstance(substance);
      setAiError(null);
      setAiSuccess(null);
      setFilters({});
      executeSubstanceSearch(substance.id, {}, 1);
    },
    [executeSubstanceSearch],
  );

  const handleSubstanceClear = useCallback(() => {
    setSelectedSubstance(null);
    setSearchResult(null);
    setHasSearched(false);
    setFilters({});
    setAiError(null);
    setAiSuccess(null);
  }, []);

  const handleUnknownSubstanceSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length < 2) return;

      setIsAiSearching(true);
      setAiError(null);
      setAiSuccess(null);
      setFilters({});
      setResearchTracker({
        phase: "searching",
        label: `Researching "${trimmed}"`,
        detail: `Resolving substance "${trimmed}"...`,
      });

      try {
        const resolved = await resolveSubstanceSearchTerm(trimmed);
        if (resolved.status === "error") {
          setAiError(resolved.message);
          setResearchTracker({
            phase: "error",
            label: `Research "${trimmed}"`,
            error: resolved.message,
          });
          return;
        }

        setSubstancesLoaded(true);
        addSubstanceOption(resolved.substance);
        setSelectedSubstance(resolved.substance);

        setResearchTracker((prev) => ({
          ...prev,
          detail: `Searching USDA + AI for ${resolved.substance.displayName} foods...`,
        }));

        const result = await aiDiscoverFoodsBySubstance(resolved.substance.id);
        setResearchTracker((prev) => ({
          ...prev,
          detail: `Refreshing foods for ${resolved.substance.displayName}...`,
        }));
        const refreshed = await searchBySubstanceId(
          resolved.substance.id,
          {},
          { page: 1, pageSize: PAGE_SIZE },
        );
        setSearchResult(refreshed);
        setHasSearched(true);

        if (result.status === "found") {
          const msg =
            resolved.status === "created"
              ? `${resolved.message} ${result.summary}`
              : result.summary;
          setAiSuccess(msg);
          setResearchTracker({
            phase: "done",
            label: `Research "${trimmed}"`,
            result: msg,
          });
        } else {
          setAiError(result.message);
          setResearchTracker({
            phase: "error",
            label: `Research "${trimmed}"`,
            error: result.message,
          });
        }
      } catch {
        setAiError("Something went wrong. Please try again.");
        setResearchTracker({
          phase: "error",
          label: `Research "${trimmed}"`,
          error: "Something went wrong. Please try again.",
        });
      } finally {
        setIsAiSearching(false);
      }
    },
    [addSubstanceOption, setResearchTracker],
  );

  // -- Shared handlers --
  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (mode === "food" && query.trim().length >= 2) {
        executeFoodSearch(query, newFilters, 1);
      } else if (mode === "substance" && selectedSubstance) {
        executeSubstanceSearch(selectedSubstance.id, newFilters, 1);
      }
    },
    [mode, query, selectedSubstance, executeFoodSearch, executeSubstanceSearch],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (mode === "food" && query.trim().length >= 2) {
        executeFoodSearch(query, filters, page);
      } else if (mode === "substance" && selectedSubstance) {
        executeSubstanceSearch(selectedSubstance.id, filters, page);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [mode, query, selectedSubstance, filters, executeFoodSearch, executeSubstanceSearch],
  );

  // AI agent: research a food not in DB
  const handleAiFoodSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsAiSearching(true);
    setAiError(null);
    setAiSuccess(null);
    setResearchTracker({
      phase: "searching",
      label: `Research "${query}"`,
      detail: `Looking up substance data for "${query}"...`,
    });

    try {
      const result = await aiSearchFood(query);
      if (result.status === "found") {
        const msg = `Added "${query}" with substance data - pending admin review`;
        setAiSuccess(msg);
        executeFoodSearch(query, filters, 1);
        setResearchTracker({ phase: "done", label: `Research "${query}"`, result: msg });
      } else {
        setAiError(result.message);
        setResearchTracker({
          phase: "error",
          label: `Research "${query}"`,
          error: result.message,
        });
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
      setResearchTracker({
        phase: "error",
        label: `Research "${query}"`,
        error: "Something went wrong. Please try again.",
      });
    } finally {
      setIsAiSearching(false);
    }
  }, [executeFoodSearch, filters, query, setResearchTracker]);

  // AI agent: discover more foods for a substance
  const handleAiSubstanceSearch = useCallback(async () => {
    const substanceId = selectedSubstance?.id ?? searchResult?.substanceId;
    const substanceName =
      selectedSubstance?.displayName ?? searchResult?.substanceName ?? "substance";
    if (!substanceId) return;
    setIsAiSearching(true);
    setAiError(null);
    setAiSuccess(null);
    setResearchTracker({
      phase: "searching",
      label: `Discover ${substanceName} foods`,
      detail: `Searching USDA database + AI for ${substanceName} foods...`,
    });

    try {
      const result = await aiDiscoverFoodsBySubstance(substanceId);
      if (result.status === "found") {
        setAiSuccess(result.summary);
        setResearchTracker({
          phase: "done",
          label: `Discover ${substanceName} foods`,
          result: result.summary,
        });
        if (selectedSubstance) {
          executeSubstanceSearch(selectedSubstance.id, filters, 1);
        } else if (query.trim().length >= 2) {
          executeFoodSearch(query, filters, 1);
        }
      } else {
        setAiError(result.message);
        setResearchTracker({
          phase: "error",
          label: `Discover ${substanceName} foods`,
          error: result.message,
        });
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
      setResearchTracker({
        phase: "error",
        label: `Discover ${substanceName} foods`,
        error: "Something went wrong. Please try again.",
      });
    } finally {
      setIsAiSearching(false);
    }
  }, [
    selectedSubstance,
    searchResult?.substanceId,
    searchResult?.substanceName,
    query,
    filters,
    executeFoodSearch,
    executeSubstanceSearch,
    setResearchTracker,
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

        const result: PdfUploadResult = await uploadSubstancePdf(formData);
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
          } else if (mode === "substance" && selectedSubstance) {
            executeSubstanceSearch(selectedSubstance.id, filters, 1);
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
    [mode, query, selectedSubstance, filters, executeFoodSearch, executeSubstanceSearch],
  );

  const isSubstanceSearch = mode === "substance" || searchResult?.searchType === "substance";
  const hasQuery = mode === "food" ? query.trim().length >= 2 : !!selectedSubstance;

  // Smart AI action
  const handleAiAction = useCallback(async () => {
    if (isSubstanceSearch) {
      await handleAiSubstanceSearch();
    } else {
      await handleAiFoodSearch();
    }
  }, [isSubstanceSearch, handleAiSubstanceSearch, handleAiFoodSearch]);

  const showResults = !isPending && hasSearched && searchResult && searchResult.totalCount > 0;
  const showFilteredEmpty =
    !isPending &&
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
          onClick={() => handleModeSwitch("substance")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200",
            mode === "substance"
              ? "bg-md-primary text-white shadow-md"
              : "text-md-on-surface-variant hover:bg-md-surface-container-high",
          )}
        >
          <span className="material-symbols-outlined text-[20px]">science</span>
          Search Substance
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
            placeholder="Search foods, ingredients, or substances..."
          />
          <div className="absolute inset-y-0 right-4 flex items-center gap-1">
            {hasQuery && (
              <button
                onClick={handleAiAction}
                disabled={isAiSearching}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-md-primary hover:bg-md-primary/10 transition-colors disabled:opacity-50"
                title={
                  isSubstanceSearch
                    ? `Discover more ${searchResult?.substanceName} foods (USDA + AI)`
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

      {/* Substance Search Picker */}
      {mode === "substance" && (
        <div className="space-y-4">
          <SubstancePicker
            substances={substancesList}
            isLoading={substancesLoading}
            isResearchingUnknown={isAiSearching}
            selectedSubstance={selectedSubstance}
            onSelect={handleSubstanceSelect}
            onSearchUnknown={handleUnknownSubstanceSearch}
            onClear={handleSubstanceClear}
          />
          {/* AI Discover button for substance mode */}
          {selectedSubstance && !isAiSearching && (
            <button
              onClick={handleAiSubstanceSearch}
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
                Upload a USDA substance report or any PDF with food substance data. The AI will
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
                Tip: Search Google for &ldquo;USDA substance database [substance name] PDF&rdquo; to
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

      {/* Non-blocking AI research hint */}
      {isAiSearching && !showResults && !showFilteredEmpty && (
        <div className="rounded-3xl border border-md-primary/15 bg-gradient-to-br from-md-primary/5 via-white to-md-tertiary/8 p-6 shadow-[0_18px_50px_rgba(0,68,147,0.08)]">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-md-primary to-md-tertiary text-white shadow-lg">
              <span className="absolute inset-0 rounded-2xl bg-md-primary/25 animate-ping" />
              <span className="material-symbols-outlined relative text-[22px] animate-pulse">
                neurology
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-md-on-surface">AI research is running</p>
              <p className="mt-1 text-sm text-md-on-surface-variant">
                {researchTracker.detail ??
                  "We are checking USDA data and research sources for you."}
              </p>
              <p className="mt-2 text-xs font-medium text-md-primary">
                Use the floating tracker in the corner to follow progress and open the result.
              </p>
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
          {!isSubstanceSearch && (
            <AiResearchPrompt query={query} onResearch={handleAiFoodSearch} aiError={aiError} />
          )}
          {isSubstanceSearch && (searchResult?.substanceId || selectedSubstance) && (
            <AiResearchPrompt
              query={selectedSubstance?.displayName ?? searchResult?.substanceName ?? query}
              onResearch={handleAiSubstanceSearch}
              aiError={aiError}
              isSubstance
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
      {aiError && !isSubstanceSearch && !isAiSearching && !showResults && (
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
        !isSubstanceSearch &&
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
                Our AI agent can research substance data for this food from USDA FoodData Central
                and nutrition literature.
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

      {/* No Results - substance mode empty state */}
      {!isAiSearching &&
        !isPending &&
        hasSearched &&
        searchResult?.totalCount === 0 &&
        mode === "substance" &&
        selectedSubstance &&
        Object.values(filters).every((v) => !v) && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-md-surface-container-high flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-md-outline">science</span>
            </div>
            <div>
              <p className="text-md-on-surface-variant">
                No foods with {selectedSubstance.displayName} data in our database yet.
              </p>
            </div>

            <div className="bg-gradient-to-br from-md-primary/5 to-md-tertiary/5 border border-md-primary/15 rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex items-center gap-3 justify-center mb-3">
                <span className="material-symbols-outlined text-md-primary">neurology</span>
                <h4 className="font-bold text-md-on-surface">Discover with AI</h4>
              </div>
              <p className="text-sm text-md-on-surface-variant mb-4">
                Our AI agent will search USDA FoodData Central and nutrition research to find foods
                rich in {selectedSubstance.displayName}.
              </p>
              <button
                onClick={handleAiSubstanceSearch}
                className="bg-md-primary text-white font-bold py-3 px-8 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90"
              >
                Discover {selectedSubstance.displayName} foods
              </button>
            </div>
          </div>
        )}

      {/* Substance Wisdom (show when no search in food mode) */}
      {mode === "food" && !hasSearched && !isPending && !isAiSearching && !showUpload && (
        <div className="bg-gradient-to-br from-md-primary to-md-primary-container p-6 rounded-3xl text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-2xl font-bold mb-2">Substance Wisdom</h4>
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

      {/* Substance mode welcome (show when no substance selected) */}
      {mode === "substance" && !selectedSubstance && !isPending && !isAiSearching && (
        <div className="bg-gradient-to-br from-md-tertiary to-md-tertiary-container p-6 rounded-3xl text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-2xl font-bold mb-2">Substance Explorer</h4>
            <p className="text-md-tertiary-fixed-dim text-sm max-w-[70%] leading-relaxed">
              Pick a saved substance or type a new one and we will research foods for it. Great for
              targeted dietary planning and missing substances.
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
  isSubstance,
}: {
  query: string;
  onResearch: () => void;
  aiError: string | null;
  isSubstance?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-md-primary/5 to-md-tertiary/5 border border-md-primary/10 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-md-primary text-[20px]">neurology</span>
        <p className="text-sm text-md-on-surface-variant">
          {isSubstance ? "Want more foods?" : "Can\u0027t find what you need?"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {aiError && <p className="text-xs text-md-error">{aiError}</p>}
        <button
          onClick={onResearch}
          className="inline-flex items-center gap-2 bg-md-primary text-white font-bold py-2 px-5 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90 text-sm"
        >
          {isSubstance
            ? `Discover more ${query} foods (USDA + AI)`
            : `AI Research \u201c${query}\u201d`}
        </button>
      </div>
    </div>
  );
}
