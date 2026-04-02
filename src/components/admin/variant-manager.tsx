"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { addVariant, deleteVariant } from "@/app/(admin)/foods/actions";
import type { AdminFoodVariant } from "@/types";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PREPARATION_METHODS = [
  "raw",
  "boiled",
  "steamed",
  "grilled",
  "baked",
  "fried",
  "roasted",
  "sauteed",
  "poached",
  "blanched",
  "drained",
];

interface VariantManagerProps {
  foodId: string;
  variants: AdminFoodVariant[];
  onSelectVariant: (variantId: string) => void;
  selectedVariantId: string | null;
}

export function VariantManager({
  foodId,
  variants,
  onSelectVariant,
  selectedVariantId,
}: VariantManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newMethod, setNewMethod] = useState("raw");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await addVariant({
        foodId,
        preparationMethod: newMethod,
        description: newDescription || undefined,
        isDefault: variants.length === 0,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setShowAdd(false);
        setNewMethod("raw");
        setNewDescription("");
        router.refresh();
      }
    });
  };

  const handleDelete = (variantId: string) => {
    if (!confirm("Delete this variant and all its substance values?")) return;
    startTransition(async () => {
      const result = await deleteVariant({ variantId });
      if ("error" in result) alert(result.error);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Variants</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="rounded-lg border p-3 space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Preparation Method</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
              >
                {PREPARATION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description (optional)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Lightly steamed, 3 minutes"
                className="h-8 text-sm"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={pending}>
                {pending ? "Adding..." : "Add Variant"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {variants.length === 0 && !showAdd && (
          <p className="text-muted-foreground py-2 text-sm">No variants yet.</p>
        )}

        {variants.map((v) => (
          <div
            key={v.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
              selectedVariantId === v.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
            onClick={() => onSelectVariant(v.id)}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">{v.preparationMethod}</span>
                {v.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>
              {v.description && <p className="text-muted-foreground text-xs">{v.description}</p>}
              <p className="text-muted-foreground text-xs">
                {v.substances.length} substance{v.substances.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(v.id);
              }}
              disabled={pending}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
