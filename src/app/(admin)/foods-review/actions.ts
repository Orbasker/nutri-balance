"use server";

import { revalidatePath } from "next/cache";

import type { FoodFeedbackItem, FoodReviewItem } from "@/types";
import { and, avg, count, eq, inArray, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { foodFeedback } from "@/lib/db/schema/feedback";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { nutrientObservations } from "@/lib/db/schema/observations";
import { reviews } from "@/lib/db/schema/reviews";
import { approveFoodSchema, deleteFoodSchema, dismissFeedbackSchema } from "@/lib/validators";

export type AdminActionResult = { ok: true } | { error: string };

export async function getPendingFoods(): Promise<FoodReviewItem[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  // Get foods that have at least one pending observation
  const foodsWithPending = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      foodCategory: foods.category,
      foodCreatedAt: foods.createdAt,
      foodCreatedBy: foods.createdBy,
    })
    .from(foods)
    .innerJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .innerJoin(
      nutrientObservations,
      and(
        eq(nutrientObservations.foodVariantId, foodVariants.id),
        eq(nutrientObservations.reviewStatus, "pending"),
      ),
    )
    .groupBy(foods.id, foods.name, foods.category, foods.createdAt, foods.createdBy);

  if (foodsWithPending.length === 0) return [];

  const foodIds = foodsWithPending.map((f) => f.foodId);

  // Batch fetch variant counts
  const variantCounts = await db
    .select({
      foodId: foodVariants.foodId,
      variantCount: count(foodVariants.id),
    })
    .from(foodVariants)
    .where(inArray(foodVariants.foodId, foodIds))
    .groupBy(foodVariants.foodId);

  // Batch fetch pending observation counts and avg confidence
  const obsStats = await db
    .select({
      foodId: foodVariants.foodId,
      pendingCount: count(nutrientObservations.id),
      avgConfidence: avg(nutrientObservations.confidenceScore),
    })
    .from(nutrientObservations)
    .innerJoin(foodVariants, eq(foodVariants.id, nutrientObservations.foodVariantId))
    .where(
      and(inArray(foodVariants.foodId, foodIds), eq(nutrientObservations.reviewStatus, "pending")),
    )
    .groupBy(foodVariants.foodId);

  // Batch fetch feedback counts
  const feedbackCounts = await db
    .select({
      foodId: foodFeedback.foodId,
      feedbackCount: count(foodFeedback.id),
    })
    .from(foodFeedback)
    .where(inArray(foodFeedback.foodId, foodIds))
    .groupBy(foodFeedback.foodId);

  // Batch fetch variants with their nutrients
  const variantRows = await db
    .select({
      id: foodVariants.id,
      foodId: foodVariants.foodId,
      preparationMethod: foodVariants.preparationMethod,
    })
    .from(foodVariants)
    .where(inArray(foodVariants.foodId, foodIds));

  const variantIds = variantRows.map((v) => v.id);

  const nutrientRows =
    variantIds.length > 0
      ? await db
          .select({
            foodVariantId: nutrientObservations.foodVariantId,
            nutrientDisplayName: nutrients.displayName,
            value: nutrientObservations.value,
            unit: nutrientObservations.unit,
            confidenceScore: nutrientObservations.confidenceScore,
            reviewStatus: nutrientObservations.reviewStatus,
          })
          .from(nutrientObservations)
          .innerJoin(nutrients, eq(nutrients.id, nutrientObservations.nutrientId))
          .where(inArray(nutrientObservations.foodVariantId, variantIds))
      : [];

  // Build maps
  const variantCountMap = new Map(variantCounts.map((v) => [v.foodId, Number(v.variantCount)]));
  const obsStatsMap = new Map(
    obsStats.map((o) => [
      o.foodId,
      { pendingCount: Number(o.pendingCount), avgConfidence: Math.round(Number(o.avgConfidence)) },
    ]),
  );
  const feedbackCountMap = new Map(feedbackCounts.map((f) => [f.foodId, Number(f.feedbackCount)]));

  // Build nutrient map per variant
  const nutrientsByVariant = new Map<string, typeof nutrientRows>();
  for (const n of nutrientRows) {
    const list = nutrientsByVariant.get(n.foodVariantId) ?? [];
    list.push(n);
    nutrientsByVariant.set(n.foodVariantId, list);
  }

  // Build variant map per food
  const variantsByFood = new Map<
    string,
    Array<{ id: string; preparationMethod: string; nutrients: typeof nutrientRows }>
  >();
  for (const v of variantRows) {
    const list = variantsByFood.get(v.foodId) ?? [];
    list.push({
      id: v.id,
      preparationMethod: v.preparationMethod,
      nutrients: nutrientsByVariant.get(v.id) ?? [],
    });
    variantsByFood.set(v.foodId, list);
  }

  return foodsWithPending.map((f) => {
    const stats = obsStatsMap.get(f.foodId) ?? { pendingCount: 0, avgConfidence: 0 };
    const foodVariantList = variantsByFood.get(f.foodId) ?? [];

    return {
      id: f.foodId,
      name: f.foodName,
      category: f.foodCategory,
      createdAt: f.foodCreatedAt.toISOString(),
      createdBy: f.foodCreatedBy,
      variantCount: variantCountMap.get(f.foodId) ?? 0,
      pendingObservationCount: stats.pendingCount,
      avgConfidence: stats.avgConfidence,
      feedbackCount: feedbackCountMap.get(f.foodId) ?? 0,
      variants: foodVariantList.map((v) => ({
        id: v.id,
        preparationMethod: v.preparationMethod,
        nutrients: v.nutrients.map((n) => ({
          nutrientDisplayName: n.nutrientDisplayName,
          value: Number(n.value),
          unit: n.unit,
          confidenceScore: n.confidenceScore ?? 50,
          reviewStatus: n.reviewStatus,
        })),
      })),
    };
  });
}

export async function approveFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = approveFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // Get all variant IDs for this food
  const variantRows = await db
    .select({ id: foodVariants.id })
    .from(foodVariants)
    .where(eq(foodVariants.foodId, parsed.data.foodId));

  const variantIds = variantRows.map((v) => v.id);

  if (variantIds.length === 0) return { error: "No variants found for this food." };

  // Get pending observation IDs
  const pendingObs = await db
    .select({ id: nutrientObservations.id })
    .from(nutrientObservations)
    .where(
      and(
        inArray(nutrientObservations.foodVariantId, variantIds),
        eq(nutrientObservations.reviewStatus, "pending"),
      ),
    );

  if (pendingObs.length === 0) return { error: "No pending observations to approve." };

  const obsIds = pendingObs.map((o) => o.id);

  // Bulk update observations to approved
  await db
    .update(nutrientObservations)
    .set({ reviewStatus: "approved" })
    .where(inArray(nutrientObservations.id, obsIds));

  // Insert review records
  await db.insert(reviews).values(
    obsIds.map((obsId) => ({
      entityType: "nutrient_observation",
      entityId: obsId,
      reviewerId: adminId,
      status: "approved" as const,
    })),
  );

  revalidatePath("/foods-review");
  return { ok: true };
}

export async function deleteFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db.delete(foods).where(eq(foods.id, parsed.data.foodId));

  revalidatePath("/foods-review");
  return { ok: true };
}

export async function getFoodFeedback(foodId: string): Promise<FoodFeedbackItem[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  const rows = await db
    .select({
      id: foodFeedback.id,
      foodId: foodFeedback.foodId,
      nutrientId: foodFeedback.nutrientId,
      foodVariantId: foodFeedback.foodVariantId,
      userId: foodFeedback.userId,
      type: foodFeedback.type,
      message: foodFeedback.message,
      suggestedValue: foodFeedback.suggestedValue,
      suggestedUnit: foodFeedback.suggestedUnit,
      sourceUrl: foodFeedback.sourceUrl,
      status: foodFeedback.status,
      createdAt: foodFeedback.createdAt,
      reviewedAt: foodFeedback.reviewedAt,
      nutrientDisplayName: nutrients.displayName,
      nutrientUnit: nutrients.unit,
    })
    .from(foodFeedback)
    .leftJoin(nutrients, eq(nutrients.id, foodFeedback.nutrientId))
    .where(eq(foodFeedback.foodId, foodId))
    .orderBy(sql`${foodFeedback.createdAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    foodId: r.foodId,
    nutrientId: r.nutrientId,
    foodVariantId: r.foodVariantId,
    userId: r.userId,
    type: r.type,
    message: r.message,
    suggestedValue: r.suggestedValue ? Number(r.suggestedValue) : null,
    suggestedUnit: r.suggestedUnit,
    sourceUrl: r.sourceUrl,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    nutrientDisplayName: r.nutrientDisplayName ?? undefined,
    nutrientUnit: r.nutrientUnit ?? undefined,
  }));
}

export async function dismissFeedback(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = dismissFeedbackSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db
    .update(foodFeedback)
    .set({
      status: "dismissed",
      reviewedAt: new Date(),
    })
    .where(eq(foodFeedback.id, parsed.data.feedbackId));

  revalidatePath("/foods-review");
  return { ok: true };
}
