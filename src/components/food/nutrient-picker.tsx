"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { NutrientOption } from "@/types";

import { cn } from "@/lib/utils";

interface NutrientPickerProps {
  nutrients: NutrientOption[];
  isLoading: boolean;
  isResearchingUnknown?: boolean;
  selectedNutrient: NutrientOption | null;
  onSelect: (nutrient: NutrientOption) => void;
  onSearchUnknown?: (query: string) => void;
  onClear: () => void;
}

export function NutrientPicker({
  nutrients,
  isLoading,
  isResearchingUnknown = false,
  selectedNutrient,
  onSelect,
  onSearchUnknown,
  onClear,
}: NutrientPickerProps) {
  const [filterText, setFilterText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return nutrients;
    const term = filterText.toLowerCase();
    return nutrients.filter(
      (n) => n.displayName.toLowerCase().includes(term) || n.name.toLowerCase().includes(term),
    );
  }, [nutrients, filterText]);

  // Highlight reset is handled in the onChange handler below

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-nutrient-item]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback(
    (nutrient: NutrientOption) => {
      setFilterText("");
      setIsOpen(false);
      setHighlightIndex(-1);
      onSelect(nutrient);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && highlightIndex >= 0 && highlightIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[highlightIndex]);
      } else if (e.key === "Enter" && filtered.length === 0 && filterText.trim().length >= 2) {
        e.preventDefault();
        onSearchUnknown?.(filterText.trim());
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    },
    [filterText, filtered, highlightIndex, handleSelect, onSearchUnknown],
  );

  if (selectedNutrient) {
    return (
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-md-primary">science</span>
        </div>
        <div className="w-full bg-md-surface-container-lowest border-none py-5 pl-14 pr-28 rounded-2xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] text-md-on-surface flex items-center gap-2">
          <span className="font-bold">{selectedNutrient.displayName}</span>
          <span className="text-md-outline text-sm">({selectedNutrient.unit})</span>
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <button
            onClick={onClear}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-md-outline hover:text-md-error hover:bg-md-error/10 transition-colors"
            title="Clear selection"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-md-outline">science</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setHighlightIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay close so clicks on items register
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-md-surface-container-lowest border-none py-5 pl-14 pr-6 rounded-2xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] focus:ring-2 focus:ring-md-primary/20 text-md-on-surface placeholder:text-md-outline transition-all duration-300 outline-none"
          placeholder={isLoading ? "Loading nutrients..." : "Search nutrients or type a new one..."}
          disabled={isLoading || isResearchingUnknown}
        />
      </div>

      {/* Dropdown */}
      {isOpen && !isLoading && (
        <div
          ref={listRef}
          className="absolute z-50 top-full mt-2 left-0 right-0 bg-md-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-md-outline/10 max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-5 py-4 text-center space-y-3">
              <p className="text-sm text-md-outline">
                No saved nutrients found for &ldquo;{filterText}&rdquo;.
              </p>
              {filterText.trim().length >= 2 && onSearchUnknown && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSearchUnknown(filterText.trim())}
                  disabled={isResearchingUnknown}
                  className="inline-flex items-center gap-2 bg-md-primary text-white font-bold py-2 px-4 rounded-xl active:scale-95 transition-all duration-200 hover:bg-md-primary/90 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                  {isResearchingUnknown
                    ? "Researching..."
                    : `Research "${filterText.trim()}" anyway`}
                </button>
              )}
            </div>
          ) : (
            filtered.map((nutrient, idx) => (
              <button
                key={nutrient.id}
                data-nutrient-item
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(nutrient)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={cn(
                  "w-full text-left px-5 py-3 flex items-center justify-between transition-colors",
                  idx === highlightIndex
                    ? "bg-md-primary/10 text-md-primary"
                    : "text-md-on-surface hover:bg-md-surface-container",
                  idx === 0 && "rounded-t-2xl",
                  idx === filtered.length - 1 && "rounded-b-2xl",
                )}
              >
                <span className="font-medium">{nutrient.displayName}</span>
                <span className="text-xs text-md-outline">{nutrient.unit}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
