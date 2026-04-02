"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  createCustomSubstance,
  removeCustomSubstance,
  removeSubstanceLimit,
  saveMedicalNotes,
  saveSubstanceLimit,
} from "./actions";

export type SubstanceOptionDto = {
  id: string;
  name: string;
  unit: string;
  display_name: string;
  sort_order: number | null;
  created_by: string | null;
};

export type UserSubstanceLimitDto = {
  id: string;
  user_id: string;
  substance_id: string;
  daily_limit: string;
  mode: "strict" | "stability";
  range_min: string | null;
  range_max: string | null;
};

type SubstanceLimitsSettingsProps = {
  substances: SubstanceOptionDto[];
  limits: UserSubstanceLimitDto[];
  medicalNotes: string;
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

export function SubstanceLimitsSettings({
  substances,
  limits,
  medicalNotes: initialNotes,
}: SubstanceLimitsSettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftSubstanceIds, setDraftSubstanceIds] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const limitBySubstance = useMemo(() => {
    const m = new Map<string, UserSubstanceLimitDto>();
    for (const l of limits) {
      m.set(l.substance_id, l);
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

      {/* Daily Substance Limits */}
      <section className="bg-md-surface-container-lowest p-8 rounded-xl shadow-[0_10px_30px_rgba(0,68,147,0.06)]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-md-primary">clinical_notes</span>
            <h3 className="font-bold text-lg">Daily Substance Limits</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-md-primary hover:text-md-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showAddForm ? "close" : "add_circle"}
            </span>
            {showAddForm ? "Cancel" : "Add Substance"}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-8 p-5 bg-md-surface-container-low rounded-xl space-y-4">
            <p className="text-sm font-bold text-md-on-surface">Add a custom substance to track</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="flex-1 bg-md-surface-container-lowest rounded-lg px-4 py-2.5 text-sm text-md-on-surface placeholder:text-md-outline/50 outline-none focus:ring-2 focus:ring-md-primary/20"
                placeholder="Name (e.g. Gluten, Caffeine, Fiber)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="w-full sm:w-28 bg-md-surface-container-lowest rounded-lg px-4 py-2.5 text-sm text-md-on-surface placeholder:text-md-outline/50 outline-none focus:ring-2 focus:ring-md-primary/20"
                placeholder="Unit (e.g. mg)"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              />
              <button
                type="button"
                disabled={pending || !newName.trim() || !newUnit.trim()}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const res = await createCustomSubstance({
                      displayName: newName.trim(),
                      unit: newUnit.trim(),
                    });
                    if ("error" in res) {
                      setError(res.error);
                      return;
                    }
                    setNewName("");
                    setNewUnit("");
                    setShowAddForm(false);
                    refresh();
                  });
                }}
                className="bg-md-primary text-white font-bold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
              >
                {pending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {substances.map((substance, i) => {
            const limit = limitBySubstance.get(substance.id);
            const isTracked = !!limit || draftSubstanceIds.has(substance.id);

            return (
              <SubstanceLimitField
                key={substance.id}
                substance={substance}
                limit={limit}
                isTracked={isTracked}
                isFirst={i === 0}
                isCustom={!!substance.created_by}
                disabled={pending}
                onToggle={(on) => {
                  setError(null);
                  if (on) {
                    setDraftSubstanceIds((prev) => new Set(prev).add(substance.id));
                    return;
                  }
                  setDraftSubstanceIds((prev) => {
                    const next = new Set(prev);
                    next.delete(substance.id);
                    return next;
                  });
                  if (limit) {
                    startTransition(async () => {
                      const res = await removeSubstanceLimit({ limitId: limit.id });
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
                    const res = await saveSubstanceLimit(payload);
                    if ("error" in res) {
                      setError(res.error);
                      return;
                    }
                    setDraftSubstanceIds((prev) => {
                      const next = new Set(prev);
                      next.delete(substance.id);
                      return next;
                    });
                    refresh();
                  });
                }}
                onRemoveSubstance={() => {
                  setError(null);
                  startTransition(async () => {
                    const res = await removeCustomSubstance({ substanceId: substance.id });
                    if ("error" in res) {
                      setError(res.error);
                      return;
                    }
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
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesSaved(false);
            }}
          />
          <button
            disabled={pending}
            onClick={() => {
              setError(null);
              setNotesSaved(false);
              startTransition(async () => {
                const res = await saveMedicalNotes(notes);
                if ("error" in res) {
                  setError(res.error);
                  return;
                }
                setNotesSaved(true);
                refresh();
              });
            }}
            className="mt-6 w-full bg-md-primary text-white font-bold py-4 rounded-xl active:scale-95 transition-all duration-200 disabled:opacity-60"
          >
            {pending ? "Saving..." : notesSaved ? "Saved!" : "Save Configurations"}
          </button>
        </section>
      </div>
    </div>
  );
}

function SubstanceLimitField({
  substance,
  limit,
  isTracked,
  isFirst,
  isCustom,
  disabled,
  onToggle,
  onSave,
  onRemoveSubstance,
}: {
  substance: SubstanceOptionDto;
  limit: UserSubstanceLimitDto | undefined;
  isTracked: boolean;
  isFirst: boolean;
  isCustom: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  onSave: (payload: {
    substanceId: string;
    limitId?: string;
    mode: "strict" | "stability";
    dailyLimit?: string;
    rangeMin?: string;
    rangeMax?: string;
  }) => Promise<void>;
  onRemoveSubstance: () => void;
}) {
  const [dailyLimit, setDailyLimit] = useState(limit?.daily_limit ?? "");

  return (
    <div className="group border-b border-md-outline-variant/15 pb-4 focus-within:border-md-primary transition-all">
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <label
            className={cn(
              "block text-xs font-bold uppercase tracking-widest",
              isFirst ? "text-md-primary" : "text-md-outline",
            )}
          >
            {substance.display_name}
          </label>
          {isCustom && (
            <span className="text-[10px] font-bold text-md-primary/60 bg-md-primary/8 px-1.5 py-0.5 rounded">
              CUSTOM
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCustom && (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemoveSubstance}
              className="text-md-error/60 hover:text-md-error transition-colors disabled:opacity-50"
              aria-label={`Remove ${substance.display_name}`}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
          <ToggleSwitch checked={isTracked} disabled={disabled} onCheckedChange={onToggle} />
        </div>
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
                  substanceId: substance.id,
                  limitId: limit?.id,
                  mode: "strict",
                  dailyLimit,
                });
              }
            }}
          />
          <span className="text-md-on-surface-variant font-medium whitespace-nowrap">
            {substance.unit}/day
          </span>
        </div>
      )}
    </div>
  );
}
