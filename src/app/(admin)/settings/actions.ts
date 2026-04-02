"use server";

import { revalidatePath } from "next/cache";

import {
  CONFIG_KEYS,
  type ConfigKeyDef,
  deleteConfigValue,
  getAllConfig,
  setConfigValue,
} from "@/lib/app-config";
import { requireAdmin } from "@/lib/auth-admin";

export type SettingsData = Awaited<ReturnType<typeof getAllConfig>>;

export async function getSettings(): Promise<SettingsData> {
  const adminId = await requireAdmin();
  if (!adminId) return {};
  return getAllConfig();
}

function findConfigDef(key: string): ConfigKeyDef | null {
  return Object.values(CONFIG_KEYS).find((def) => def.key === key) ?? null;
}

export async function updateSetting(
  key: string,
  rawValue: string,
): Promise<{ ok: true } | { error: string }> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const def = findConfigDef(key);
  if (!def) return { error: `Unknown config key: ${key}` };

  // Parse the value based on what makes sense
  let parsed: unknown;
  const trimmed = rawValue.trim();

  if (trimmed === "") {
    // Empty = delete (revert to env var)
    await deleteConfigValue(def);
    revalidatePath("/settings");
    return { ok: true };
  }

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not valid JSON — store as string
    parsed = trimmed;
  }

  await setConfigValue(def, parsed);
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetSetting(key: string): Promise<{ ok: true } | { error: string }> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const def = findConfigDef(key);
  if (!def) return { error: `Unknown config key: ${key}` };

  await deleteConfigValue(def);
  revalidatePath("/settings");
  return { ok: true };
}
