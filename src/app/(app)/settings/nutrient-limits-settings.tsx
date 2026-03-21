"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

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

function ToggleSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-md-primary" : "bg-md-surface-container",
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
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
      {error && (
        <p className="text-md-error text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Daily Nutrient Limits */}
      <section className="bg-md-surface-container-lowest p-8 rounded-xl shadow-[0_10px_30px_rgba(0,68,147,0.06)]">
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-md-primary">clinical_notes</span>
          <h3 className="font-bold text-lg">Daily Nutrient Limits</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {nutrients.map((n, i) => {
            const limit = limitByNutrient.get(n.id);
            const isTracked = !!limit || draftNutrientIds.has(n.id);

            return (
              <NutrientLimitField
                key={n.id}
                nutrient={n}
                limit={limit}
                isTracked={isTracked}
                isFirst={i === 0}
                disabled={pending}
                onToggle={(on) => {
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
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Tracking Modes */}
        <section className="md:col-span-2 bg-md-surface-container-low p-8 rounded-xl flex flex-col justify-between space-y-8">
          <div>
            <h3 className="font-bold text-lg mb-6">Tracking Modes</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-md-on-surface">Strict Mode</p>
                  <p className="text-xs text-md-on-surface-variant max-w-[150px]">
                    Hard stop notifications when limits are hit.
                  </p>
                </div>
                <ToggleSwitch checked={true} onCheckedChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-md-on-surface">Stability Mode</p>
                  <p className="text-xs text-md-on-surface-variant max-w-[150px]">
                    Focuses on consistent day-to-day variance.
                  </p>
                </div>
                <ToggleSwitch checked={false} onCheckedChange={() => {}} />
              </div>
            </div>
          </div>
          <div className="bg-md-primary/5 p-4 rounded-lg">
            <p className="text-[10px] uppercase font-extrabold tracking-tighter text-md-primary">
              Status
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
              </div>
              <span className="text-xs font-bold text-md-primary">High Confidence Active</span>
            </div>
          </div>
        </section>

        {/* Medical Notes */}
        <section className="md:col-span-3 bg-md-surface-container-lowest p-8 rounded-xl shadow-[0_10px_30px_rgba(0,68,147,0.06)] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-md-outline">description</span>
            <h3 className="font-bold text-lg">Medical Notes</h3>
          </div>
          <textarea
            className="w-full flex-grow bg-md-surface-container-low border-none rounded-xl p-5 text-md-on-surface text-sm leading-relaxed placeholder:text-md-outline/50 focus:ring-2 focus:ring-md-primary/20 min-h-[200px] outline-none"
            placeholder="Add context for your physician or personal record... e.g., 'Currently on Coumadin, monitoring Vitamin K intake for INR stability.'"
          />
          <button className="mt-6 w-full bg-md-primary text-white font-bold py-4 rounded-xl active:scale-95 transition-all duration-200">
            Save Configurations
          </button>
        </section>
      </div>
    </div>
  );
}

function NutrientLimitField({
  nutrient,
  limit,
  isTracked,
  isFirst,
  disabled,
  onToggle,
  onSave,
}: {
  nutrient: NutrientDto;
  limit: UserNutrientLimitDto | undefined;
  isTracked: boolean;
  isFirst: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  onSave: (payload: {
    nutrientId: string;
    limitId?: string;
    mode: "strict" | "stability";
    dailyLimit?: string;
    rangeMin?: string;
    rangeMax?: string;
  }) => Promise<void>;
}) {
  const [dailyLimit, setDailyLimit] = useState(limit?.daily_limit ?? "");

  return (
    <div className="group border-b border-md-outline-variant/15 pb-4 focus-within:border-md-primary transition-all">
      <div className="flex justify-between items-start mb-1">
        <label
          className={cn(
            "block text-xs font-bold uppercase tracking-widest",
            isFirst ? "text-md-primary" : "text-md-outline",
          )}
        >
          {nutrient.display_name}
        </label>
        <ToggleSwitch checked={isTracked} disabled={disabled} onCheckedChange={onToggle} />
      </div>
      {isTracked && (
        <div className="flex items-baseline gap-2">
          <input
            className="w-full bg-transparent border-none p-0 text-2xl font-bold text-md-on-surface focus:ring-0 outline-none"
            placeholder="0"
            type="text"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            onBlur={() => {
              if (dailyLimit) {
                void onSave({
                  nutrientId: nutrient.id,
                  limitId: limit?.id,
                  mode: "strict",
                  dailyLimit,
                });
              }
            }}
          />
          <span className="text-md-on-surface-variant font-medium whitespace-nowrap">
            {nutrient.unit}/day
          </span>
        </div>
      )}
    </div>
  );
}
