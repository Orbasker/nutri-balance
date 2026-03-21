"use client";

import { useState, useTransition } from "react";

import { deleteLogEntry, getVariantNutrientValues, updateLogEntry } from "@/app/(app)/log/actions";
import type { LogEntry, LogEntryNutrientInfo } from "@/types";
import { Pencil, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { calculateNutrientAmount } from "@/lib/calculations";

interface LogEntryRowProps {
  entry: LogEntry;
  nutrientInfo: LogEntryNutrientInfo[];
}

export function LogEntryRow({ entry, nutrientInfo }: LogEntryRowProps) {
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
      // Recalculate nutrient snapshot based on new grams
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

  // Show top nutrient amounts from snapshot
  const topNutrients = nutrientInfo
    .filter((n) => entry.nutrientSnapshot[n.nutrientId] != null)
    .slice(0, 3);

  const time = new Date(entry.loggedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white p-3 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{entry.foodName}</span>
            {entry.preparationMethod !== "raw" && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {entry.preparationMethod}
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span>{time}</span>
            {!editing && (
              <span>
                {entry.quantity.toFixed(0)}g{entry.servingLabel ? ` (${entry.servingLabel})` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setEditing(false);
                setEditGrams(String(entry.quantity));
                setError(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setEditing(true)}
                disabled={deletePending}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
                onClick={handleDelete}
                disabled={deletePending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            step="1"
            value={editGrams}
            onChange={(e) => setEditGrams(e.target.value)}
            className="h-8 w-24 text-sm"
            placeholder="grams"
          />
          <span className="text-muted-foreground text-xs">g</span>
          <Button size="sm" className="h-8" onClick={handleSaveEdit} disabled={editPending}>
            {editPending ? "Saving..." : "Save"}
          </Button>
        </div>
      )}

      {topNutrients.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
          {topNutrients.map((n) => (
            <span key={n.nutrientId}>
              {n.displayName}: {entry.nutrientSnapshot[n.nutrientId]!.toFixed(1)} {n.unit}
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
