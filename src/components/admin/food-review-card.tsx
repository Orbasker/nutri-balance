"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  approveFood,
  deleteFood,
  dismissFeedback,
  getFoodFeedback,
} from "@/app/(admin)/foods-review/actions";
import type { FoodFeedbackItem, FoodReviewItem } from "@/types";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FoodReviewCard({ food }: { food: FoodReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FoodFeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  function handleApprove() {
    setResult(null);
    startTransition(async () => {
      const res = await approveFood({ foodId: food.id });
      setResult(res);
      if ("ok" in res) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setResult(null);
    startTransition(async () => {
      const res = await deleteFood({ foodId: food.id });
      setResult(res);
      if ("ok" in res) {
        router.refresh();
      }
    });
  }

  async function handleToggleFeedback() {
    if (feedbackOpen) {
      setFeedbackOpen(false);
      return;
    }
    setFeedbackLoading(true);
    const items = await getFoodFeedback(food.id);
    setFeedbackItems(items);
    setFeedbackLoading(false);
    setFeedbackOpen(true);
  }

  function handleDismiss(feedbackId: string) {
    startTransition(async () => {
      const res = await dismissFeedback({ feedbackId });
      if ("ok" in res) {
        setFeedbackItems((prev) =>
          prev.map((f) => (f.id === feedbackId ? { ...f, status: "dismissed" as const } : f)),
        );
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">{food.name}</h3>
            <p className="text-xs text-muted-foreground">
              {food.category && <span>{food.category} &middot; </span>}
              Created {new Date(food.createdAt).toLocaleDateString()}
            </p>
          </div>
          {food.createdBy && (
            <Badge variant="secondary" className="text-xs shrink-0">
              AI-generated
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {food.variantCount} variant{food.variantCount !== 1 ? "s" : ""}
          </span>
          <span>&middot;</span>
          <span>{food.pendingObservationCount} pending</span>
          <span>&middot;</span>
          <span>Avg conf: {food.avgConfidence}%</span>
          <span>&middot;</span>
          <span>{food.feedbackCount} feedback</span>
        </div>

        {/* Variants & Nutrients toggle */}
        <button
          onClick={() => setVariantsOpen(!variantsOpen)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {variantsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Variants & Nutrients
        </button>

        {variantsOpen && (
          <div className="space-y-2 pl-2 border-l-2 border-muted">
            {food.variants.map((v) => (
              <div key={v.id} className="space-y-1">
                <Badge variant="outline" className="text-xs">
                  {v.preparationMethod}
                </Badge>
                {v.nutrients.length > 0 ? (
                  <div className="grid grid-cols-1 gap-0.5 text-xs">
                    {v.nutrients.map((n, i) => (
                      <div key={i} className="flex justify-between gap-2 text-muted-foreground">
                        <span>{n.nutrientDisplayName}</span>
                        <span>
                          {n.value} {n.unit}
                          <span className="ml-1 text-[10px]">
                            ({n.confidenceScore}%{" "}
                            <span
                              className={
                                n.reviewStatus === "approved"
                                  ? "text-green-600"
                                  : n.reviewStatus === "pending"
                                    ? "text-amber-600"
                                    : "text-red-600"
                              }
                            >
                              {n.reviewStatus}
                            </span>
                            )
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No nutrients</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Feedback toggle */}
        <button
          onClick={handleToggleFeedback}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {feedbackOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          User Feedback ({food.feedbackCount})
        </button>

        {feedbackLoading && (
          <p className="text-xs text-muted-foreground italic pl-2">Loading feedback...</p>
        )}

        {feedbackOpen && !feedbackLoading && (
          <div className="space-y-2 pl-2 border-l-2 border-muted">
            {feedbackItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No feedback submitted.</p>
            ) : (
              feedbackItems.map((fb) => (
                <div key={fb.id} className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={fb.type === "flag" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {fb.type}
                    </Badge>
                    {fb.nutrientDisplayName && (
                      <span className="text-muted-foreground">{fb.nutrientDisplayName}</span>
                    )}
                    <Badge
                      variant={fb.status === "open" ? "outline" : "secondary"}
                      className="text-[10px]"
                    >
                      {fb.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{fb.message}</p>
                  {fb.type === "correction" && fb.suggestedValue !== null && (
                    <p className="text-foreground font-medium">
                      Suggested: {fb.suggestedValue} {fb.suggestedUnit}
                    </p>
                  )}
                  {fb.sourceUrl && (
                    <a
                      href={fb.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Source
                    </a>
                  )}
                  {fb.status === "open" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleDismiss(fb.id)}
                      disabled={pending}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Result messages */}
        {result && "error" in result && (
          <p className="text-xs text-destructive font-medium">{result.error}</p>
        )}
        {result && "ok" in result && (
          <p className="text-xs text-green-600 font-medium">Action completed successfully.</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={pending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {pending ? "..." : "Approve All"}
          </Button>

          <Dialog>
            <DialogTrigger
              render={
                <Button size="sm" variant="destructive" className="flex-1" disabled={pending} />
              }
            >
              Delete Food
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {food.name}?</DialogTitle>
                <DialogDescription>
                  This permanently deletes the food and all its variants, observations, evidence,
                  and feedback. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                  {pending ? "Deleting..." : "Delete permanently"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
