"use client";

import { useState } from "react";

import type { ConfidenceLabel, SearchFilters } from "@/types";

interface SearchFiltersBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  availableCategories: string[];
}

const confidenceLevels: { value: ConfidenceLabel | ""; label: string }[] = [
  { value: "", label: "All confidence" },
  { value: "high", label: "High (90-100)" },
  { value: "good", label: "Good (80-89)" },
  { value: "moderate", label: "Moderate (60-79)" },
  { value: "low", label: "Low (<60)" },
];

export function SearchFiltersBar({
  filters,
  onChange,
  availableCategories,
}: SearchFiltersBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = [
    filters.category,
    filters.confidenceLevel,
    filters.aiGeneratedOnly,
  ].filter(Boolean).length;

  const handleClearAll = () => {
    onChange({});
  };

  return (
    <div className="space-y-3">
      {/* Filter toggle button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-2 text-sm font-medium text-md-on-surface-variant hover:text-md-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-md-primary text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <span
            className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs font-medium text-md-error hover:text-md-error/80 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter controls */}
      {isExpanded && (
        <div className="flex flex-wrap gap-3 bg-md-surface-container-lowest rounded-2xl p-4 border border-md-outline-variant/20">
          {/* Category filter */}
          {availableCategories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-md-outline">
                Category
              </label>
              <select
                value={filters.category ?? ""}
                onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
                className="bg-md-surface-container-low border border-md-outline-variant/30 rounded-xl px-3 py-2 text-sm text-md-on-surface outline-none focus:ring-2 focus:ring-md-primary/20 min-w-[160px]"
              >
                <option value="">All categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Confidence level filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-md-outline">
              Confidence
            </label>
            <select
              value={filters.confidenceLevel ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  confidenceLevel: (e.target.value as ConfidenceLabel) || undefined,
                })
              }
              className="bg-md-surface-container-low border border-md-outline-variant/30 rounded-xl px-3 py-2 text-sm text-md-on-surface outline-none focus:ring-2 focus:ring-md-primary/20 min-w-[160px]"
            >
              {confidenceLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* AI-generated toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-md-outline">
              Source
            </label>
            <button
              onClick={() =>
                onChange({ ...filters, aiGeneratedOnly: !filters.aiGeneratedOnly || undefined })
              }
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${
                filters.aiGeneratedOnly
                  ? "bg-md-tertiary-fixed/30 border-md-tertiary/30 text-md-on-surface"
                  : "bg-md-surface-container-low border-md-outline-variant/30 text-md-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">neurology</span>
              AI Generated
            </button>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {filters.category && (
            <FilterChip
              label={filters.category}
              onRemove={() => onChange({ ...filters, category: undefined })}
            />
          )}
          {filters.confidenceLevel && (
            <FilterChip
              label={`${filters.confidenceLevel} confidence`}
              onRemove={() => onChange({ ...filters, confidenceLevel: undefined })}
            />
          )}
          {filters.aiGeneratedOnly && (
            <FilterChip
              label="AI Generated"
              onRemove={() => onChange({ ...filters, aiGeneratedOnly: undefined })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-md-primary-fixed/30 text-md-on-primary-fixed-variant rounded-full px-3 py-1 text-xs font-medium capitalize">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-md-error transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </span>
  );
}
