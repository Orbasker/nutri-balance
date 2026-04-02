import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appConfig } from "@/lib/db/schema/app-config";
import {
  DEFAULT_SUBSTANCE_REFERENCE_VALUES,
  type SubstanceReferenceValues,
  sanitizeSubstanceReferenceValues,
} from "@/lib/substance-reference-values";

/**
 * Well-known config keys and their env var fallbacks.
 */
export const CONFIG_KEYS = {
  AI_MODEL_PRICING: {
    key: "ai_model_pricing",
    envVar: "AI_MODEL_PRICING_JSON",
    label: "AI Model Pricing",
    description:
      "Per-model token pricing for cost estimation (JSON: model → {inputPer1M, outputPer1M})",
  },
  AI_JOB_COST_ALERT_THRESHOLD: {
    key: "ai_job_cost_alert_threshold_usd",
    envVar: "AI_JOB_COST_ALERT_THRESHOLD_USD",
    label: "Job Cost Alert Threshold (USD)",
    description: "Send an alert when a single AI job exceeds this cost",
  },
  AI_USAGE_ALERT_THRESHOLD: {
    key: "ai_usage_alert_threshold_usd",
    envVar: "AI_USAGE_ALERT_THRESHOLD_USD",
    label: "Usage Event Alert Threshold (USD)",
    description: "Send an alert when a single AI usage event exceeds this cost",
  },
  OPS_NOTIFY_ON_SUCCESS: {
    key: "ops_notify_on_success",
    envVar: "OPS_NOTIFY_ON_SUCCESS",
    label: "Notify on Success",
    description: "Send email alerts for successful AI job completions (not just failures)",
  },
  ALERT_EMAIL_TO: {
    key: "alert_email_to",
    envVar: "ALERT_EMAIL_TO",
    label: "Alert Email Recipient",
    description: "Email address for ops alert notifications",
  },
  SUBSTANCE_REFERENCE_VALUES: {
    key: "substance_reference_values",
    envVar: "SUBSTANCE_REFERENCE_VALUES_JSON",
    label: "Substance Reference Values",
    description:
      "Reference nutrient targets used to rank the most nutritionally prominent substance (JSON: substance_name -> target value in the substance unit).",
    defaultValue: DEFAULT_SUBSTANCE_REFERENCE_VALUES,
  },
} as const;

export type ConfigKeyDef = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

/**
 * Read a config value from the database, falling back to env vars and then code defaults.
 */
export async function getConfigValue<T = unknown>(def: ConfigKeyDef): Promise<T | null> {
  const row = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, def.key))
    .limit(1);

  if (row.length > 0 && row[0].value != null) {
    return row[0].value as T;
  }

  // Fall back to env var
  const envRaw = process.env[def.envVar];
  if (!envRaw) {
    return ("defaultValue" in def ? (def.defaultValue as T) : null) ?? null;
  }

  // Try to parse as JSON; if that fails, return as string
  try {
    return JSON.parse(envRaw) as T;
  } catch {
    return envRaw as T;
  }
}

/**
 * Read all config values, merging DB values with env var defaults.
 */
export async function getAllConfig(): Promise<
  Record<
    string,
    {
      value: unknown;
      source: "database" | "env" | "default" | "unset";
      description: string;
      label: string;
    }
  >
> {
  const dbRows = await db.select().from(appConfig);
  const dbMap = new Map(dbRows.map((r) => [r.key, r.value]));

  const result: Record<
    string,
    {
      value: unknown;
      source: "database" | "env" | "default" | "unset";
      description: string;
      label: string;
    }
  > = {};

  for (const def of Object.values(CONFIG_KEYS)) {
    const dbValue = dbMap.get(def.key);

    if (dbValue != null) {
      result[def.key] = {
        value: dbValue,
        source: "database",
        description: def.description,
        label: def.label,
      };
      continue;
    }

    const envRaw = process.env[def.envVar];
    if (envRaw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(envRaw);
      } catch {
        parsed = envRaw;
      }
      result[def.key] = {
        value: parsed,
        source: "env",
        description: def.description,
        label: def.label,
      };
      continue;
    }

    if ("defaultValue" in def) {
      result[def.key] = {
        value: def.defaultValue,
        source: "default",
        description: def.description,
        label: def.label,
      };
      continue;
    }

    result[def.key] = {
      value: null,
      source: "unset",
      description: def.description,
      label: def.label,
    };
  }

  return result;
}

/**
 * Set a config value in the database (upsert).
 */
export async function setConfigValue(def: ConfigKeyDef, value: unknown): Promise<void> {
  await db
    .insert(appConfig)
    .values({
      key: def.key,
      value: value as Record<string, unknown>,
      description: def.description,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: {
        value: value as Record<string, unknown>,
        description: def.description,
        updatedAt: new Date(),
      },
    });
}

/**
 * Delete a config value from the database (reverts to env var fallback).
 */
export async function deleteConfigValue(def: ConfigKeyDef): Promise<void> {
  await db.delete(appConfig).where(eq(appConfig.key, def.key));
}

export async function getSubstanceReferenceValues(): Promise<SubstanceReferenceValues> {
  const configured = await getConfigValue<unknown>(CONFIG_KEYS.SUBSTANCE_REFERENCE_VALUES);
  return sanitizeSubstanceReferenceValues(configured);
}
