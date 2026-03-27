"use server";

import { revalidatePath } from "next/cache";

import type { PendingObservation } from "@/types";
import { eq, inArray } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { evidenceItems, nutrientObservations } from "@/lib/db/schema/observations";
import { reviews } from "@/lib/db/schema/reviews";
import { reviewObservationSchema } from "@/lib/validators";

export type ReviewActionResult = { ok: true } | { error: string };

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
    .innerJoin(foodVariants, eq(foodVariants.id, nutrientObservations.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(nutrients, eq(nutrients.id, nutrientObservations.nutrientId))
    .where(eq(nutrientObservations.reviewStatus, "pending"))
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
    .where(inArray(evidenceItems.observationId, observationIds));

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

  // Update the observation's review status
  await db
    .update(nutrientObservations)
    .set({ reviewStatus: parsed.data.status as "approved" | "rejected" | "pending" })
    .where(eq(nutrientObservations.id, parsed.data.observationId));

  // Create a review record
  await db.insert(reviews).values({
    entityType: "nutrient_observation",
    entityId: parsed.data.observationId,
    reviewerId: adminId,
    status: parsed.data.status as "approved" | "rejected" | "pending",
    notes: parsed.data.notes || null,
  });

  revalidatePath("/review");
  revalidatePath("/ai-observations");
  return { ok: true };
}
