"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { submitFeedbackSchema } from "@/lib/validators";

export type FeedbackActionResult = { ok: true } | { error: string };

export async function submitFeedback(raw: unknown): Promise<FeedbackActionResult> {
  const parsed = submitFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("food_feedback").insert({
    food_id: parsed.data.foodId,
    nutrient_id: parsed.data.nutrientId ?? null,
    food_variant_id: parsed.data.foodVariantId ?? null,
    user_id: user.id,
    type: parsed.data.type,
    message: parsed.data.message,
    suggested_value: parsed.data.suggestedValue ? String(parsed.data.suggestedValue) : null,
    suggested_unit: parsed.data.suggestedUnit ?? null,
    source_url: parsed.data.sourceUrl ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/food/${parsed.data.foodId}`);
  return { ok: true };
}
