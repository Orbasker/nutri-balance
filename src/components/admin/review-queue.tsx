"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { reviewObservation } from "@/app/(admin)/review/actions";
import type { PendingObservation } from "@/types";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ReviewQueue({ observations }: { observations: PendingObservation[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const handleReview = (
    observationId: string,
    status: "approved" | "rejected" | "needs_revision",
  ) => {
    startTransition(async () => {
      const result = await reviewObservation({
        observationId,
        status,
        notes: notes[observationId] || undefined,
      });
      if ("error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  };

  if (observations.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No pending observations to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {observations.map((obs) => {
        const isExpanded = expandedId === obs.id;

        return (
          <Card key={obs.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{obs.foodName}</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {obs.preparationMethod}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{obs.substanceDisplayName}:</span>{" "}
                    <span className="font-medium">
                      {obs.value} {obs.unit}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{obs.derivationType.replace("_", " ")}</span>
                    <span>Confidence: {obs.confidenceScore}</span>
                    {obs.evidenceItems.length > 0 && (
                      <span>{obs.evidenceItems.length} evidence item(s)</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setExpandedId(isExpanded ? null : obs.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3">
                  {obs.evidenceItems.length > 0 && (
                    <div>
                      <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                        Evidence
                      </h4>
                      <div className="space-y-1.5">
                        {obs.evidenceItems.map((e) => (
                          <div key={e.id} className="rounded-md bg-muted/50 p-2 text-sm">
                            {e.snippet && <p>{e.snippet}</p>}
                            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                              {e.pageRef && <span>Page: {e.pageRef}</span>}
                              {e.rowLocator && <span>Row: {e.rowLocator}</span>}
                              {e.url && (
                                <a
                                  href={e.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline"
                                >
                                  Source
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium">Notes (optional)</label>
                    <Textarea
                      value={notes[obs.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [obs.id]: e.target.value }))}
                      placeholder="Add review notes..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleReview(obs.id, "approved")}
                      disabled={pending}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(obs.id, "needs_revision")}
                      disabled={pending}
                    >
                      Needs Revision
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReview(obs.id, "rejected")}
                      disabled={pending}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
