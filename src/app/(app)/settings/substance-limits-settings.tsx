"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import type { SubstanceCategory } from "@/types";

import { cn } from "@/lib/utils";

import {
  bulkEnableSubstances,
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
  category: string | null;
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

const CUSTOM_UNIT_VALUE = "__custom__";
const UNIT_OPTIONS = ["mg", "mcg", "g", "IU", "mEq", "kcal"] as const;

const CATEGORY_ORDER: SubstanceCategory[] = [
  "macronutrient",
  "lipid",
  "vitamin",
  "mineral",
  "other",
];

const CATEGORY_LABELS: Record<SubstanceCategory, string> = {
  macronutrient: "Macronutrients",
  lipid: "Fats & Fatty Acids",
  vitamin: "Vitamins",
  mineral: "Minerals",
  other: "Other",
};

const CATEGORY_ICONS: Record<SubstanceCategory, string> = {
  macronutrient: "local_fire_department",
  lipid: "water_drop",
  vitamin: "wb_sunny",
  mineral: "diamond",
  other: "more_horiz",
};

// Quick-setup presets with recommended daily values (adult reference)
const PRESETS: {
  id: string;
  label: string;
  description: string;
  icon: string;
  items: Array<{ substanceName: string; dailyLimit: number; mode: "strict" | "stability" }>;
}[] = [
  {
    id: "essential",
    label: "Essentials",
    description: "Core macros + sodium for general health",
    icon: "favorite",
    items: [
      { substanceName: "energy", dailyLimit: 2000, mode: "strict" },
      { substanceName: "protein", dailyLimit: 50, mode: "strict" },
      { substanceName: "total_fat", dailyLimit: 65, mode: "strict" },
      { substanceName: "carbohydrates", dailyLimit: 300, mode: "strict" },
      { substanceName: "dietary_fiber", dailyLimit: 25, mode: "strict" },
      { substanceName: "sodium", dailyLimit: 2300, mode: "strict" },
    ],
  },
  {
    id: "vitamins",
    label: "Vitamins & Minerals",
    description: "Key micronutrients for wellness",
    icon: "wb_sunny",
    items: [
      { substanceName: "vitamin_a", dailyLimit: 900, mode: "stability" },
      { substanceName: "vitamin_c", dailyLimit: 90, mode: "stability" },
      { substanceName: "vitamin_d", dailyLimit: 20, mode: "stability" },
      { substanceName: "vitamin_k", dailyLimit: 120, mode: "stability" },
      { substanceName: "vitamin_b12", dailyLimit: 2.4, mode: "stability" },
      { substanceName: "calcium", dailyLimit: 1000, mode: "stability" },
      { substanceName: "iron", dailyLimit: 18, mode: "stability" },
      { substanceName: "magnesium", dailyLimit: 400, mode: "stability" },
      { substanceName: "potassium", dailyLimit: 4700, mode: "stability" },
      { substanceName: "zinc", dailyLimit: 11, mode: "stability" },
    ],
  },
  {
    id: "athletic",
    label: "Athletic",
    description: "Higher protein & electrolytes for training",
    icon: "fitness_center",
    items: [
      { substanceName: "energy", dailyLimit: 2800, mode: "strict" },
      { substanceName: "protein", dailyLimit: 120, mode: "strict" },
      { substanceName: "carbohydrates", dailyLimit: 400, mode: "strict" },
      { substanceName: "sodium", dailyLimit: 3000, mode: "stability" },
      { substanceName: "potassium", dailyLimit: 4700, mode: "stability" },
      { substanceName: "iron", dailyLimit: 18, mode: "stability" },
      { substanceName: "calcium", dailyLimit: 1000, mode: "stability" },
      { substanceName: "magnesium", dailyLimit: 400, mode: "stability" },
    ],
  },
];

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
  const [newUnitChoice, setNewUnitChoice] = useState<string>("");
  const [customUnit, setCustomUnit] = useState("");
  const [newCategory, setNewCategory] = useState<SubstanceCategory>("other");
  const [presetApplied, setPresetApplied] = useState<string | null>(null);

  const resolvedNewUnit =
    newUnitChoice === CUSTOM_UNIT_VALUE ? customUnit.trim() : newUnitChoice.trim();

  const [activeMode, setActiveMode] = useState<"strict" | "stability">(() => {
    if (limits.length === 0) return "strict";
    const stabilityCount = limits.filter((l) => l.mode === "stability").length;
    return stabilityCount > limits.length / 2 ? "stability" : "strict";
  });

  const limitBySubstance = useMemo(() => {
    const m = new Map<string, UserSubstanceLimitDto>();
    for (const l of limits) {
      m.set(l.substance_id, l);
    }
    return m;
  }, [limits]);

  // Group substances by category
  const groupedSubstances = useMemo(() => {
    const map = new Map<SubstanceCategory, SubstanceOptionDto[]>();
    for (const s of substances) {
      const cat = (s.category as SubstanceCategory) ?? "other";
      const list = map.get(cat) ?? [];
      list.push(s);
      map.set(cat, list);
    }
    return map;
  }, [substances]);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<SubstanceCategory>>(
    () => new Set(),
  );

  function toggleCategoryCollapse(cat: SubstanceCategory) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function refresh() {
    router.refresh();
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setError(null);
    setPresetApplied(null);
    startTransition(async () => {
      const res = await bulkEnableSubstances(preset.items);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setPresetApplied(preset.id);
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-md-error text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Quick Setup Presets */}
      <section className="bg-md-surface-container-lowest p-8 rounded-xl shadow-[0_10px_30px_rgba(0,68,147,0.06)]">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-md-primary">bolt</span>
          <h3 className="font-bold text-lg">Quick Setup</h3>
        </div>
        <p className="text-sm text-md-on-surface-variant mb-6">
          Start tracking with a preset. You can customize individual limits after.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((preset) => {
            const isApplied = presetApplied === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={pending}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "p-4 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-50",
                  isApplied
                    ? "bg-md-primary text-white"
                    : "bg-md-surface-container-low hover:bg-md-surface-container",
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-2xl mb-2 block",
                    isApplied ? "text-white" : "text-md-primary",
                  )}
                >
                  {preset.icon}
                </span>
                <p className="font-bold text-sm">{preset.label}</p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    isApplied ? "text-white/80" : "text-md-on-surface-variant",
                  )}
                >
                  {isApplied ? `${preset.items.length} limits applied!` : preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

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
            {showAddForm ? "Cancel" : "Add New Nutrient"}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-8 p-5 bg-md-surface-container-low rounded-xl space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-md-on-surface">
                Add a nutrient for everyone to use
              </p>
              <p className="text-xs text-md-on-surface-variant">
                This will be available to all users. Give it a clear name and correct unit.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  className="flex-1 bg-md-surface-container-lowest rounded-lg px-4 py-2.5 text-sm text-md-on-surface placeholder:text-md-outline/50 outline-none focus:ring-2 focus:ring-md-primary/20"
                  placeholder="Name (e.g. Taurine, Oxalate)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <select
                  className="w-full sm:w-40 bg-md-surface-container-lowest border border-md-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-md-on-surface outline-none focus:ring-2 focus:ring-md-primary/20"
                  value={newUnitChoice}
                  onChange={(e) => setNewUnitChoice(e.target.value)}
                >
                  <option value="">Choose unit</option>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  <option value={CUSTOM_UNIT_VALUE}>Custom unit</option>
                </select>
                {newUnitChoice === CUSTOM_UNIT_VALUE && (
                  <input
                    className="w-full sm:w-32 bg-md-surface-container-lowest rounded-lg px-4 py-2.5 text-sm text-md-on-surface placeholder:text-md-outline/50 outline-none focus:ring-2 focus:ring-md-primary/20"
                    placeholder="Custom unit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                  />
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="w-full sm:w-56 bg-md-surface-container-lowest border border-md-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-md-on-surface outline-none focus:ring-2 focus:ring-md-primary/20"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SubstanceCategory)}
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !newName.trim() || !resolvedNewUnit}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const res = await createCustomSubstance({
                        displayName: newName.trim(),
                        unit: resolvedNewUnit,
                        category: newCategory,
                      });
                      if ("error" in res) {
                        setError(res.error);
                        return;
                      }
                      setNewName("");
                      setNewUnitChoice("");
                      setCustomUnit("");
                      setNewCategory("other");
                      setShowAddForm(false);
                      refresh();
                    });
                  }}
                  className="bg-md-primary text-white font-bold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
                >
                  {pending ? "Adding..." : "Add Nutrient"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grouped substance list */}
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const items = groupedSubstances.get(cat);
            if (!items || items.length === 0) return null;
            const isCollapsed = collapsedCategories.has(cat);
            const trackedCount = items.filter(
              (s) => limitBySubstance.has(s.id) || draftSubstanceIds.has(s.id),
            ).length;

            return (
              <div key={cat}>
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(cat)}
                  className="w-full flex items-center justify-between mb-4 group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-md-primary text-lg">
                      {CATEGORY_ICONS[cat]}
                    </span>
                    <h4 className="font-bold text-sm text-md-on-surface">{CATEGORY_LABELS[cat]}</h4>
                    <span className="text-xs text-md-outline bg-md-surface-container-high px-2 py-0.5 rounded-full">
                      {trackedCount}/{items.length}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "material-symbols-outlined text-md-outline text-lg transition-transform duration-200",
                      isCollapsed ? "" : "rotate-180",
                    )}
                  >
                    expand_more
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                    {items.map((substance, i) => {
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
                          activeMode={activeMode}
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
                              const res = await removeCustomSubstance({
                                substanceId: substance.id,
                              });
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
                )}
              </div>
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
                <ToggleSwitch
                  checked={activeMode === "strict"}
                  disabled={pending}
                  onCheckedChange={() => setActiveMode("strict")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-md-on-surface">Stability Mode</p>
                  <p className="text-xs text-md-on-surface-variant max-w-[150px]">
                    Focuses on consistent day-to-day variance.
                  </p>
                </div>
                <ToggleSwitch
                  checked={activeMode === "stability"}
                  disabled={pending}
                  onCheckedChange={() => setActiveMode("stability")}
                />
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
              <span className="text-xs font-bold text-md-primary">
                {activeMode === "strict" ? "High Confidence Active" : "Stability Tracking Active"}
              </span>
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
                const res = await saveMedicalNotes({ notes });
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
  activeMode,
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
  activeMode: "strict" | "stability";
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
  const [rangeMin, setRangeMin] = useState(limit?.range_min ?? "");
  const [rangeMax, setRangeMax] = useState(limit?.range_max ?? "");

  function saveStrict() {
    if (dailyLimit) {
      void onSave({
        substanceId: substance.id,
        limitId: limit?.id,
        mode: "strict",
        dailyLimit,
      });
    }
  }

  function saveStability() {
    if (rangeMin && rangeMax) {
      void onSave({
        substanceId: substance.id,
        limitId: limit?.id,
        mode: "stability",
        rangeMin,
        rangeMax,
      });
    }
  }

  return (
    <div className="group border-b border-md-outline-variant/15 pb-4 pt-2 focus-within:border-md-primary transition-all">
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
            <span className="text-[10px] bg-md-tertiary-container text-md-on-tertiary-container px-1.5 py-0.5 rounded font-bold">
              Community
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
      {isTracked && activeMode === "strict" && (
        <div className="flex items-baseline gap-2">
          <input
            className="w-full bg-transparent border-none p-0 text-2xl font-bold text-md-on-surface focus:ring-0 outline-none"
            placeholder="0"
            type="text"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            onBlur={saveStrict}
          />
          <span className="text-md-on-surface-variant font-medium whitespace-nowrap">
            {substance.unit}/day
          </span>
        </div>
      )}
      {isTracked && activeMode === "stability" && (
        <div className="flex items-baseline gap-2">
          <input
            className="w-20 bg-transparent border-none p-0 text-2xl font-bold text-md-on-surface focus:ring-0 outline-none"
            placeholder="min"
            type="text"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            onBlur={saveStability}
          />
          <span className="text-md-on-surface-variant font-medium">-</span>
          <input
            className="w-20 bg-transparent border-none p-0 text-2xl font-bold text-md-on-surface focus:ring-0 outline-none"
            placeholder="max"
            type="text"
            value={rangeMax}
            onChange={(e) => setRangeMax(e.target.value)}
            onBlur={saveStability}
          />
          <span className="text-md-on-surface-variant font-medium whitespace-nowrap">
            {substance.unit}/day
          </span>
        </div>
      )}
    </div>
  );
}
