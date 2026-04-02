"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { deleteSubstanceValue, saveSubstanceValue } from "@/app/(admin)/foods/actions";
import type { AdminSubstanceValue, SubstanceOption } from "@/types";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SubstanceValueEditorProps {
  foodVariantId: string;
  substances: AdminSubstanceValue[];
  allSubstances: SubstanceOption[];
}

export function SubstanceValueEditor({
  foodVariantId,
  substances,
  allSubstances,
}: SubstanceValueEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const existingSubstanceIds = new Set(substances.map((n) => n.substanceId));
  const availableSubstances = allSubstances.filter((n) => !existingSubstanceIds.has(n.id));
  const [newSubstanceId, setNewSubstanceId] = useState(availableSubstances[0]?.id ?? "");
  const [newValue, setNewValue] = useState("");
  const [newConfidence, setNewConfidence] = useState("50");

  // Edit form state
  const [editValue, setEditValue] = useState("");
  const [editConfidence, setEditConfidence] = useState("");

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveSubstanceValue({
        foodVariantId,
        substanceId: newSubstanceId,
        valuePer100g: Number(newValue),
        confidenceScore: Number(newConfidence),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setShowAdd(false);
        setNewValue("");
        setNewConfidence("50");
        router.refresh();
      }
    });
  };

  const handleEdit = (resolvedId: string) => {
    setError(null);
    const n = substances.find((n) => n.resolvedId === resolvedId);
    if (!n) return;

    startTransition(async () => {
      const result = await saveSubstanceValue({
        foodVariantId,
        substanceId: n.substanceId,
        valuePer100g: Number(editValue),
        confidenceScore: Number(editConfidence),
        resolvedId,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setEditingId(null);
        router.refresh();
      }
    });
  };

  const handleDelete = (resolvedId: string) => {
    if (!confirm("Delete this substance value?")) return;
    startTransition(async () => {
      const result = await deleteSubstanceValue({ resolvedId });
      if ("error" in result) alert(result.error);
      router.refresh();
    });
  };

  const startEdit = (n: AdminSubstanceValue) => {
    setEditingId(n.resolvedId);
    setEditValue(String(n.valuePer100g));
    setEditConfidence(String(n.confidenceScore));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Substance Values (per 100g)</CardTitle>
        {availableSubstances.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="rounded-lg border p-3 space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Substance</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={newSubstanceId}
                onChange={(e) => setNewSubstanceId(e.target.value)}
              >
                {availableSubstances.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName} ({n.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium">Value per 100g</label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs font-medium">Confidence</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newConfidence}
                  onChange={(e) => setNewConfidence(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {error && showAdd && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={pending || !newValue}>
                {pending ? "Saving..." : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {substances.length === 0 && !showAdd && (
          <p className="text-muted-foreground py-2 text-sm">No substance values yet.</p>
        )}

        <div className="divide-y">
          {substances.map((n) => (
            <div key={n.resolvedId} className="flex items-center justify-between py-2">
              {editingId === n.resolvedId ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="w-32 text-sm">{n.substanceDisplayName}</span>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 w-24 text-sm"
                  />
                  <span className="text-muted-foreground text-xs">{n.substanceUnit}</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editConfidence}
                    onChange={(e) => setEditConfidence(e.target.value)}
                    className="h-7 w-16 text-sm"
                    title="Confidence score"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => handleEdit(n.resolvedId)}
                    disabled={pending}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-3"
                    onClick={() => startEdit(n)}
                  >
                    <span className="w-32 text-sm">{n.substanceDisplayName}</span>
                    <span className="text-sm font-medium">
                      {n.valuePer100g} {n.substanceUnit}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      confidence: {n.confidenceScore}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(n.resolvedId)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {error && editingId && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
