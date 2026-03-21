"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  deleteUserNutrientLimitSchema,
  saveUserNutrientLimitSchema,
  toUserNutrientLimitRow,
} from "@/lib/validators";

export type NutrientLimitActionResult = { ok: true } | { error: string };

export async function saveNutrientLimit(raw: unknown): Promise<NutrientLimitActionResult> {
  const parsed = saveUserNutrientLimitSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const row = toUserNutrientLimitRow(parsed.data);
  const { limitId, nutrientId } = parsed.data;

  if (limitId) {
    const { error } = await supabase
      .from("user_nutrient_limits")
      .update({
        daily_limit: row.daily_limit,
        mode: row.mode,
        range_min: row.range_min,
        range_max: row.range_max,
      })
      .eq("id", limitId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }
    revalidatePath("/settings");
    return { ok: true };
  }

  const { data: existingRows, error: selectError } = await supabase
    .from("user_nutrient_limits")
    .select("id")
    .eq("nutrient_id", nutrientId)
    .limit(1);

  if (selectError) {
    return { error: selectError.message };
  }

  const existing = existingRows?.[0];

  if (existing?.id) {
    const { error } = await supabase
      .from("user_nutrient_limits")
      .update({
        daily_limit: row.daily_limit,
        mode: row.mode,
        range_min: row.range_min,
        range_max: row.range_max,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }
    revalidatePath("/settings");
    return { ok: true };
  }

  const { error } = await supabase.from("user_nutrient_limits").insert({
    user_id: user.id,
    nutrient_id: nutrientId,
    daily_limit: row.daily_limit,
    mode: row.mode,
    range_min: row.range_min,
    range_max: row.range_max,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function saveMedicalNotes(notes: string): Promise<NutrientLimitActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ clinical_notes: notes })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeNutrientLimit(raw: unknown): Promise<NutrientLimitActionResult> {
  const parsed = deleteUserNutrientLimitSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid limit id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("user_nutrient_limits")
    .delete()
    .eq("id", parsed.data.limitId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
