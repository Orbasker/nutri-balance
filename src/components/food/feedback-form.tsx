"use client";

import { useState, useTransition } from "react";

import { submitFeedback } from "@/app/(app)/food/[id]/feedback-actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackFormProps {
  foodId: string;
  variants: Array<{
    id: string;
    preparationMethod: string;
    substances: Array<{
      substanceId: string;
      displayName: string;
      unit: string;
    }>;
  }>;
}

export function FeedbackForm({ foodId, variants }: FeedbackFormProps) {
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"flag" | "correction">("flag");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedSubstanceId, setSelectedSubstanceId] = useState("");
  const [message, setMessage] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedSubstance = selectedVariant?.substances.find(
    (n) => n.substanceId === selectedSubstanceId,
  );

  function resetForm() {
    setType("flag");
    setSelectedVariantId("");
    setSelectedSubstanceId("");
    setMessage("");
    setSuggestedValue("");
    setSourceUrl("");
  }

  function handleSubmit() {
    setResult(null);

    startTransition(async () => {
      const data: Record<string, unknown> = {
        foodId,
        type,
        message,
      };

      if (selectedSubstanceId) {
        data.substanceId = selectedSubstanceId;
      }
      if (selectedVariantId) {
        data.foodVariantId = selectedVariantId;
      }
      if (type === "correction" && suggestedValue) {
        data.suggestedValue = Number(suggestedValue);
        if (selectedSubstance) {
          data.suggestedUnit = selectedSubstance.unit;
        }
      }
      if (sourceUrl) {
        data.sourceUrl = sourceUrl;
      }

      const res = await submitFeedback(data);
      setResult(res);

      if ("ok" in res) {
        resetForm();
      }
    });
  }

  if (!isOpen) {
    return (
      <Card>
        <CardContent className="p-4">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">flag</span>
            Report an issue with this food data
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Report an Issue</h3>
          <button
            onClick={() => {
              setIsOpen(false);
              setResult(null);
            }}
            className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Variant selection */}
        {variants.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-variant">
              Variant
            </label>
            <select
              id="fb-variant"
              value={selectedVariantId}
              onChange={(e) => {
                setSelectedVariantId(e.target.value);
                setSelectedSubstanceId("");
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">General (all variants)</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.preparationMethod}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Substance selection */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-substance">
            Substance
          </label>
          <select
            id="fb-substance"
            value={selectedSubstanceId}
            onChange={(e) => setSelectedSubstanceId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">General feedback</option>
            {(selectedVariant?.substances ?? variants[0]?.substances ?? []).map((n) => (
              <option key={n.substanceId} value={n.substanceId}>
                {n.displayName} ({n.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Type selection */}
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="feedback-type"
                value="flag"
                checked={type === "flag"}
                onChange={() => setType("flag")}
                className="accent-primary"
              />
              Flag an issue
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="feedback-type"
                value="correction"
                checked={type === "correction"}
                onChange={() => setType("correction")}
                className="accent-primary"
              />
              Suggest a correction
            </label>
          </div>
        </div>

        {/* Correction fields */}
        {type === "correction" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-value">
              Suggested value{selectedSubstance ? ` (${selectedSubstance.unit})` : ""}
            </label>
            <Input
              id="fb-value"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 142"
              value={suggestedValue}
              onChange={(e) => setSuggestedValue(e.target.value)}
            />
          </div>
        )}

        {/* Message */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-message">
            What&apos;s wrong?
          </label>
          <Textarea
            id="fb-message"
            placeholder="Describe the issue (min 10 characters)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            aria-invalid={message.length > 0 && message.length < 10}
          />
          {message.length > 0 && message.length < 10 && (
            <p className="text-xs text-destructive">Message must be at least 10 characters.</p>
          )}
        </div>

        {/* Source URL */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-source">
            Source URL (optional)
          </label>
          <Input
            id="fb-source"
            type="url"
            placeholder="https://..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>

        {/* Result messages */}
        {result && "ok" in result && (
          <p className="text-sm text-green-600 font-medium">
            Feedback submitted successfully. Thank you!
          </p>
        )}
        {result && "error" in result && (
          <p className="text-sm text-destructive font-medium">{result.error}</p>
        )}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={pending || message.length < 10} className="w-full">
          {pending ? "Submitting..." : "Submit Feedback"}
        </Button>
      </CardContent>
    </Card>
  );
}
