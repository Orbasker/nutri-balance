"use client";

import { useState, useTransition } from "react";

import { deleteLogEntry, getVariantNutrientValues, updateLogEntry } from "@/app/(app)/log/actions";
import type { LogEntry, LogEntryNutrientInfo } from "@/types";

import { calculateNutrientAmount } from "@/lib/calculations";

interface LogEntryRowProps {
  entry: LogEntry;
  nutrientInfo: LogEntryNutrientInfo[];
  mealColorClass: string;
}

export function LogEntryRow({ entry, nutrientInfo, mealColorClass }: LogEntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [editGrams, setEditGrams] = useState(String(entry.quantity));
  const [error, setError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [editPending, startEditTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteLogEntry({ logId: entry.id });
      if ("error" in result) setError(result.error);
    });
  };

  const handleSaveEdit = () => {
    setError(null);
    const newGrams = Number(editGrams);
    if (!Number.isFinite(newGrams) || newGrams <= 0) {
      setError("Enter a positive number.");
      return;
    }

    startEditTransition(async () => {
      const valuesPerHundred = await getVariantNutrientValues(entry.foodVariantId);
      const newSnapshot: Record<string, number> = {};
      for (const [nutrientId, per100g] of Object.entries(valuesPerHundred)) {
        newSnapshot[nutrientId] = calculateNutrientAmount(per100g, newGrams);
      }

      const result = await updateLogEntry({
        logId: entry.id,
        quantity: newGrams,
        nutrientSnapshot: newSnapshot,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  };

  const topNutrients = nutrientInfo
    .filter((n) => entry.nutrientSnapshot[n.nutrientId] != null)
    .slice(0, 3);

  const time = new Date(entry.loggedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group relative bg-md-surface-container-low hover:bg-md-surface-container transition-all duration-300 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6 mb-4">
      {/* Food Thumbnail Placeholder */}
      <div className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-md-surface-container-highest flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-md-primary">restaurant</span>
      </div>

      {/* Content */}
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`${mealColorClass} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter`}
          >
            {entry.mealLabel || "Other"}
          </span>
          <span className="text-md-outline text-xs">{time}</span>
        </div>
        <h4 className="font-bold text-lg">{entry.foodName}</h4>

        {editing ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1"
              step="1"
              value={editGrams}
              onChange={(e) => setEditGrams(e.target.value)}
              className="h-8 w-24 text-sm bg-md-surface-container-lowest border border-md-outline-variant rounded-lg px-2 focus:border-md-primary focus:ring-1 focus:ring-md-primary/20 outline-none"
              placeholder="grams"
            />
            <span className="text-md-on-surface-variant text-xs">g</span>
            <button
              className="h-8 px-3 bg-md-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              onClick={handleSaveEdit}
              disabled={editPending}
            >
              {editPending ? "Saving..." : "Save"}
            </button>
            <button
              className="h-8 px-2 text-md-outline hover:text-md-on-surface"
              onClick={() => {
                setEditing(false);
                setEditGrams(String(entry.quantity));
                setError(null);
              }}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-4 mt-2">
            {topNutrients.map((n) => (
              <div key={n.nutrientId} className="text-xs text-md-outline-variant">
                <span className="font-bold text-md-on-surface">
                  {entry.nutrientSnapshot[n.nutrientId]!.toFixed(1)}
                </span>{" "}
                {n.unit}
              </div>
            ))}
            {topNutrients.length === 0 && (
              <div className="text-xs text-md-outline-variant">
                <span className="font-bold text-md-on-surface">{entry.quantity.toFixed(0)}</span>g
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit/Delete Buttons */}
      {!editing && (
        <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-10 h-10 rounded-full bg-md-surface-container-lowest flex items-center justify-center text-md-outline hover:text-md-primary shadow-sm transition-all active:scale-90"
            onClick={() => setEditing(true)}
            disabled={deletePending}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            className="w-10 h-10 rounded-full bg-md-surface-container-lowest flex items-center justify-center text-md-outline hover:text-md-error shadow-sm transition-all active:scale-90"
            onClick={handleDelete}
            disabled={deletePending}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      )}

      {error && <p className="text-xs text-md-error mt-1">{error}</p>}
    </div>
  );
}
