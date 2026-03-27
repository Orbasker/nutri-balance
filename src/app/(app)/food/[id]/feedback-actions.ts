"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { foodFeedback } from "@/lib/db/schema/feedback";
import { submitFeedbackSchema } from "@/lib/validators";

export type FeedbackActionResult = { ok: true } | { error: string };

export async function submitFeedback(raw: unknown): Promise<FeedbackActionResult> {
  const parsed = submitFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  await db.insert(foodFeedback).values({
    foodId: parsed.data.foodId,
    nutrientId: parsed.data.nutrientId ?? null,
    foodVariantId: parsed.data.foodVariantId ?? null,
    userId: session.user.id,
    type: parsed.data.type as "flag" | "correction",
    message: parsed.data.message,
    suggestedValue: parsed.data.suggestedValue ? String(parsed.data.suggestedValue) : null,
    suggestedUnit: parsed.data.suggestedUnit ?? null,
    sourceUrl: parsed.data.sourceUrl ?? null,
  });

  revalidatePath(`/food/${parsed.data.foodId}`);
  return { ok: true };
}
