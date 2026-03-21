"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { deleteFood } from "@/app/(admin)/foods/actions";
import type { AdminFoodListItem } from "@/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FoodList({ foods }: { foods: AdminFoodListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (foodId: string, foodName: string) => {
    if (!confirm(`Delete "${foodName}" and all its variants? This cannot be undone.`)) return;
    setDeletingId(foodId);
    startTransition(async () => {
      const result = await deleteFood({ foodId });
      if ("error" in result) {
        alert(result.error);
      }
      setDeletingId(null);
      router.refresh();
    });
  };

  if (foods.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No foods yet.</p>
        <Link href="/foods/new">
          <Button className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Add First Food
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {foods.map((food) => (
        <Card key={food.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/foods/${food.id}`} className="truncate font-medium hover:underline">
                  {food.name}
                </Link>
                {food.category && (
                  <Badge variant="secondary" className="shrink-0">
                    {food.category}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {food.variantCount} variant{food.variantCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link href={`/foods/${food.id}`}>
                <Button variant="ghost" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(food.id, food.name)}
                disabled={pending && deletingId === food.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
