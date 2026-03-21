"use server";

import { revalidatePath } from "next/cache";

import type { PendingObservation } from "@/types";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { evidenceItems, nutrientObservations } from "@/lib/db/schema/observations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reviewObservationSchema } from "@/lib/validators";

export type ReviewActionResult = { ok: true } | { error: string };

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user.id : null;
}

export async function getPendingObservations(): Promise<PendingObservation[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  const rows = await db
    .select({
      id: nutrientObservations.id,
      foodVariantId: nutrientObservations.foodVariantId,
      foodName: foods.name,
      preparationMethod: foodVariants.preparationMethod,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      value: nutrientObservations.value,
      unit: nutrientObservations.unit,
      derivationType: nutrientObservations.derivationType,
      confidenceScore: nutrientObservations.confidenceScore,
      reviewStatus: nutrientObservations.reviewStatus,
    })
    .from(nutrientObservations)
    .innerJoin(foodVariants, sql`${foodVariants.id} = ${nutrientObservations.foodVariantId}`)
    .innerJoin(foods, sql`${foods.id} = ${foodVariants.foodId}`)
    .innerJoin(nutrients, sql`${nutrients.id} = ${nutrientObservations.nutrientId}`)
    .where(sql`${nutrientObservations.reviewStatus} = 'pending'`)
    .orderBy(foods.name, nutrients.sortOrder);

  if (rows.length === 0) return [];

  // Batch fetch evidence items
  const observationIds = rows.map((r) => r.id);
  const evidence = await db
    .select({
      id: evidenceItems.id,
      observationId: evidenceItems.observationId,
      snippet: evidenceItems.snippet,
      pageRef: evidenceItems.pageRef,
      rowLocator: evidenceItems.rowLocator,
      url: evidenceItems.url,
    })
    .from(evidenceItems)
    .where(sql`${evidenceItems.observationId} IN ${observationIds}`);

  const evidenceMap = new Map<string, typeof evidence>();
  for (const e of evidence) {
    const list = evidenceMap.get(e.observationId) ?? [];
    list.push(e);
    evidenceMap.set(e.observationId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    foodVariantId: r.foodVariantId,
    foodName: r.foodName,
    preparationMethod: r.preparationMethod,
    nutrientName: r.nutrientName,
    nutrientDisplayName: r.nutrientDisplayName,
    value: Number(r.value),
    unit: r.unit,
    derivationType: r.derivationType,
    confidenceScore: r.confidenceScore ?? 50,
    reviewStatus: r.reviewStatus,
    evidenceItems: (evidenceMap.get(r.id) ?? []).map((e) => ({
      id: e.id,
      snippet: e.snippet,
      pageRef: e.pageRef,
      rowLocator: e.rowLocator,
      url: e.url,
    })),
  }));
}

export async function reviewObservation(raw: unknown): Promise<ReviewActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = reviewObservationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();

  // Update the observation's review status
  const { error: obsError } = await admin
    .from("nutrient_observations")
    .update({ review_status: parsed.data.status })
    .eq("id", parsed.data.observationId);

  if (obsError) return { error: obsError.message };

  // Create a review record
  const { error: reviewError } = await admin.from("reviews").insert({
    entity_type: "nutrient_observation",
    entity_id: parsed.data.observationId,
    reviewer_id: adminId,
    status: parsed.data.status,
    notes: parsed.data.notes || null,
  });

  if (reviewError) return { error: reviewError.message };

  revalidatePath("/review");
  return { ok: true };
}
