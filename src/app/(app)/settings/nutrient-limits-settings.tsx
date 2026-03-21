"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

import { removeNutrientLimit, saveNutrientLimit } from "./actions";

export type NutrientDto = {
  id: string;
  name: string;
  unit: string;
  display_name: string;
  sort_order: number | null;
};

export type UserNutrientLimitDto = {
  id: string;
  user_id: string;
  nutrient_id: string;
  daily_limit: string;
  mode: "strict" | "stability";
  range_min: string | null;
  range_max: string | null;
};

type NutrientLimitsSettingsProps = {
  nutrients: NutrientDto[];
  limits: UserNutrientLimitDto[];
};

function TrackSwitch({
  checked,
  disabled,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 rounded-full border border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}

export function NutrientLimitsSettings({ nutrients, limits }: NutrientLimitsSettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftNutrientIds, setDraftNutrientIds] = useState<Set<string>>(() => new Set());

  const limitByNutrient = useMemo(() => {
    const m = new Map<string, UserNutrientLimitDto>();
    for (const l of limits) {
      m.set(l.nutrient_id, l);
    }
    return m;
  }, [limits]);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Nutrient limits</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose which nutrients to track and set daily limits. Strict mode uses a single daily
          maximum (MVP). Stability mode stores a target range for future guidance; the upper bound
          is also kept as the daily limit for existing summaries.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {nutrients.map((n) => {
          const limit = limitByNutrient.get(n.id);
          const isTracked = !!limit;
          const showForm = isTracked || draftNutrientIds.has(n.id);
          const headingId = `nutrient-heading-${n.id}`;

          return (
            <Card key={n.id} size="sm">
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle id={headingId}>{n.display_name}</CardTitle>
                    <CardDescription>Unit: {n.unit}</CardDescription>
                  </div>
                  <TrackSwitch
                    id={headingId}
                    checked={showForm}
                    disabled={pending}
                    onCheckedChange={(on) => {
                      setError(null);
                      if (on) {
                        setDraftNutrientIds((prev) => new Set(prev).add(n.id));
                        return;
                      }
                      setDraftNutrientIds((prev) => {
                        const next = new Set(prev);
                        next.delete(n.id);
                        return next;
                      });
                      if (limit) {
                        startTransition(async () => {
                          const res = await removeNutrientLimit({ limitId: limit.id });
                          if ("error" in res) {
                            setError(res.error);
                            return;
                          }
                          refresh();
                        });
                      }
                    }}
                  />
                </div>
              </CardHeader>
              {showForm ? (
                <NutrientLimitFields
                  key={limit?.id ?? `${n.id}-new`}
                  nutrient={n}
                  limit={limit}
                  disabled={pending}
                  onSave={async (payload) => {
                    setError(null);
                    startTransition(async () => {
                      const res = await saveNutrientLimit(payload);
                      if ("error" in res) {
                        setError(res.error);
                        return;
                      }
                      setDraftNutrientIds((prev) => {
                        const next = new Set(prev);
                        next.delete(n.id);
                        return next;
                      });
                      refresh();
                    });
                  }}
                />
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NutrientLimitFields({
  nutrient,
  limit,
  disabled,
  onSave,
}: {
  nutrient: NutrientDto;
  limit: UserNutrientLimitDto | undefined;
  disabled: boolean;
  onSave: (payload: {
    nutrientId: string;
    limitId?: string;
    mode: "strict" | "stability";
    dailyLimit?: string;
    rangeMin?: string;
    rangeMax?: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"strict" | "stability">(limit?.mode ?? "strict");
  const [dailyLimit, setDailyLimit] = useState(limit?.daily_limit ?? "");
  const [rangeMin, setRangeMin] = useState(limit?.range_min ?? "");
  const [rangeMax, setRangeMax] = useState(limit?.range_max ?? "");

  return (
    <CardContent className="pt-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            nutrientId: nutrient.id,
            limitId: limit?.id,
            mode,
            dailyLimit: mode === "strict" ? dailyLimit : undefined,
            rangeMin: mode === "stability" ? rangeMin : undefined,
            rangeMax: mode === "stability" ? rangeMax : undefined,
          });
        }}
      >
        <div className="grid gap-2 sm:max-w-xs">
          <label
            className="text-muted-foreground text-xs font-medium"
            htmlFor={`mode-${nutrient.id}`}
          >
            Mode
          </label>
          <select
            id={`mode-${nutrient.id}`}
            value={mode}
            disabled={disabled}
            onChange={(e) => setMode(e.target.value as "strict" | "stability")}
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            <option value="strict">Strict (daily maximum)</option>
            <option value="stability">Stability (target range)</option>
          </select>
        </div>

        {mode === "strict" ? (
          <div className="grid gap-2 sm:max-w-xs">
            <label
              className="text-muted-foreground text-xs font-medium"
              htmlFor={`daily-${nutrient.id}`}
            >
              Daily limit ({nutrient.unit})
            </label>
            <Input
              id={`daily-${nutrient.id}`}
              inputMode="decimal"
              disabled={disabled}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="e.g. 120"
              required
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label
                className="text-muted-foreground text-xs font-medium"
                htmlFor={`rmin-${nutrient.id}`}
              >
                Range min ({nutrient.unit})
              </label>
              <Input
                id={`rmin-${nutrient.id}`}
                inputMode="decimal"
                disabled={disabled}
                value={rangeMin}
                onChange={(e) => setRangeMin(e.target.value)}
                placeholder="e.g. 80"
                required
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-muted-foreground text-xs font-medium"
                htmlFor={`rmax-${nutrient.id}`}
              >
                Range max ({nutrient.unit})
              </label>
              <Input
                id={`rmax-${nutrient.id}`}
                inputMode="decimal"
                disabled={disabled}
                value={rangeMax}
                onChange={(e) => setRangeMax(e.target.value)}
                placeholder="e.g. 120"
                required
              />
            </div>
          </div>
        )}

        <div>
          <Button type="submit" disabled={disabled}>
            {limit ? "Save changes" : "Save and track"}
          </Button>
        </div>
      </form>
    </CardContent>
  );
}
