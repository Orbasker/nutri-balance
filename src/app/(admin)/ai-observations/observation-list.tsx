"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { reviewObservation } from "@/app/(admin)/review/actions";
import type { AiObservationItem } from "@/types";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  pending: "outline",
  rejected: "destructive",
  needs_revision: "secondary",
};

export function AiObservationList({ observations }: { observations: AiObservationItem[] }) {
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
        return;
      }

      router.refresh();
    });
  };

  if (observations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground">No AI-generated observations matched this filter.</p>
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{obs.foodName}</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {obs.preparationMethod}
                    </Badge>
                    <Badge variant={statusVariant[obs.reviewStatus] ?? "outline"}>
                      {obs.reviewStatus.replace("_", " ")}
                    </Badge>
                    {obs.sourceName && <Badge variant="outline">{obs.sourceName}</Badge>}
                  </div>

                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">{obs.nutrientDisplayName}:</span>{" "}
                    <span className="font-medium">
                      {obs.value} {obs.unit}
                    </span>
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{obs.derivationType.replace("_", " ")}</span>
                    <span>Confidence: {obs.confidenceScore}</span>
                    {obs.importedAt && (
                      <span>Imported {new Date(obs.importedAt).toLocaleString()}</span>
                    )}
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
                        {obs.evidenceItems.map((evidence) => (
                          <div key={evidence.id} className="rounded-md bg-muted/50 p-2 text-sm">
                            {evidence.snippet && <p>{evidence.snippet}</p>}
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {evidence.pageRef && <span>Page: {evidence.pageRef}</span>}
                              {evidence.rowLocator && <span>Row: {evidence.rowLocator}</span>}
                              {evidence.url && (
                                <a
                                  href={evidence.url}
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
                      onChange={(event) =>
                        setNotes((prev) => ({ ...prev, [obs.id]: event.target.value }))
                      }
                      placeholder="Add review notes..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
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
