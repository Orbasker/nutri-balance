"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SubstanceOption } from "@/types";

import { cn } from "@/lib/utils";

interface SubstancePickerProps {
  substances: SubstanceOption[];
  isLoading: boolean;
  selectedSubstance: SubstanceOption | null;
  onSelect: (substance: SubstanceOption) => void;
  onClear: () => void;
}

export function SubstancePicker({
  substances,
  isLoading,
  selectedSubstance,
  onSelect,
  onClear,
}: SubstancePickerProps) {
  const [filterText, setFilterText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return substances;
    const term = filterText.toLowerCase();
    return substances.filter(
      (n) => n.displayName.toLowerCase().includes(term) || n.name.toLowerCase().includes(term),
    );
  }, [substances, filterText]);

  // Highlight reset is handled in the onChange handler below

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-substance-item]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback(
    (substance: SubstanceOption) => {
      setFilterText("");
      setIsOpen(false);
      setHighlightIndex(-1);
      onSelect(substance);
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
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    },
    [filtered, highlightIndex, handleSelect],
  );

  if (selectedSubstance) {
    return (
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-md-primary">science</span>
        </div>
        <div className="w-full bg-md-surface-container-lowest border-none py-5 pl-14 pr-28 rounded-2xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] text-md-on-surface flex items-center gap-2">
          <span className="font-bold">{selectedSubstance.displayName}</span>
          <span className="text-md-outline text-sm">({selectedSubstance.unit})</span>
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
          placeholder={isLoading ? "Loading substances..." : "Type to filter substances..."}
          disabled={isLoading}
        />
      </div>

      {/* Dropdown */}
      {isOpen && !isLoading && (
        <div
          ref={listRef}
          className="absolute z-50 top-full mt-2 left-0 right-0 bg-md-surface-container-lowest rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-md-outline/10 max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-5 py-4 text-sm text-md-outline text-center">
              No substances found matching &ldquo;{filterText}&rdquo;
            </div>
          ) : (
            filtered.map((substance, idx) => (
              <button
                key={substance.id}
                data-substance-item
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(substance)}
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
                <span className="font-medium">{substance.displayName}</span>
                <span className="text-xs text-md-outline">{substance.unit}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
