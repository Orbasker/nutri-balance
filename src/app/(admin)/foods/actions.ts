"use server";

import { revalidatePath } from "next/cache";

import type {
  AdminFoodDetail,
  AdminFoodListItem,
  AdminFoodVariant,
  SubstanceOption,
} from "@/types";
import { count, eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import {
  addVariantSchema,
  createFoodSchema,
  deleteFoodSchema,
  deleteSubstanceValueSchema,
  deleteVariantSchema,
  saveSubstanceValueSchema,
  updateFoodSchema,
} from "@/lib/validators";

export type AdminActionResult = { ok: true } | { error: string };

export async function getAdminFoods(): Promise<AdminFoodListItem[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  const rows = await db
    .select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      createdAt: foods.createdAt,
      updatedAt: foods.updatedAt,
    })
    .from(foods)
    .orderBy(foods.name);

  // Get variant counts
  const variantCounts = await db
    .select({
      foodId: foodVariants.foodId,
      count: count(),
    })
    .from(foodVariants)
    .groupBy(foodVariants.foodId);

  const countMap = new Map(variantCounts.map((r) => [r.foodId, r.count]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    variantCount: countMap.get(r.id) ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getAdminFoodDetail(foodId: string): Promise<AdminFoodDetail | null> {
  const adminId = await requireAdmin();
  if (!adminId) return null;

  const rows = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      description: foods.description,
      variantId: foodVariants.id,
      preparationMethod: foodVariants.preparationMethod,
      variantDescription: foodVariants.description,
      isDefault: foodVariants.isDefault,
      resolvedId: resolvedSubstanceValues.id,
      substanceId: substances.id,
      substanceName: substances.name,
      substanceDisplayName: substances.displayName,
      substanceUnit: substances.unit,
      valuePer100g: resolvedSubstanceValues.valuePer100g,
      confidenceScore: resolvedSubstanceValues.confidenceScore,
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(resolvedSubstanceValues, eq(resolvedSubstanceValues.foodVariantId, foodVariants.id))
    .leftJoin(substances, eq(substances.id, resolvedSubstanceValues.substanceId))
    .where(eq(foods.id, foodId))
    .orderBy(foodVariants.preparationMethod, substances.sortOrder);

  if (rows.length === 0) return null;

  const first = rows[0];
  const variantMap = new Map<string, AdminFoodVariant>();

  for (const row of rows) {
    if (!row.variantId) continue;

    let variant = variantMap.get(row.variantId);
    if (!variant) {
      variant = {
        id: row.variantId,
        preparationMethod: row.preparationMethod!,
        description: row.variantDescription ?? null,
        isDefault: row.isDefault ?? false,
        substances: [],
      };
      variantMap.set(row.variantId, variant);
    }

    if (
      row.resolvedId &&
      row.substanceId &&
      !variant.substances.some((n) => n.resolvedId === row.resolvedId)
    ) {
      variant.substances.push({
        resolvedId: row.resolvedId,
        substanceId: row.substanceId,
        substanceName: row.substanceName!,
        substanceDisplayName: row.substanceDisplayName!,
        substanceUnit: row.substanceUnit!,
        valuePer100g: Number(row.valuePer100g),
        confidenceScore: row.confidenceScore ?? 50,
      });
    }
  }

  return {
    id: first.foodId,
    name: first.foodName,
    category: first.category ?? null,
    description: first.description ?? null,
    variants: Array.from(variantMap.values()),
  };
}

export async function getAllSubstances(): Promise<SubstanceOption[]> {
  const rows = await db
    .select({
      id: substances.id,
      name: substances.name,
      displayName: substances.displayName,
      unit: substances.unit,
    })
    .from(substances)
    .orderBy(substances.sortOrder);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    unit: r.unit,
  }));
}

export async function createFood(raw: unknown): Promise<AdminActionResult & { foodId?: string }> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = createFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const [data] = await db
    .insert(foods)
    .values({
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
    })
    .returning({ id: foods.id });

  revalidatePath("/review");
  return { ok: true, foodId: data.id };
}

export async function updateFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = updateFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db
    .update(foods)
    .set({
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      updatedAt: new Date(),
    })
    .where(eq(foods.id, parsed.data.foodId));

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid food ID." };

  await db.delete(foods).where(eq(foods.id, parsed.data.foodId));

  revalidatePath("/review");
  return { ok: true };
}

export async function addVariant(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = addVariantSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db.insert(foodVariants).values({
    foodId: parsed.data.foodId,
    preparationMethod: parsed.data.preparationMethod as
      | "raw"
      | "boiled"
      | "steamed"
      | "grilled"
      | "baked"
      | "fried"
      | "roasted"
      | "sauteed"
      | "poached"
      | "blanched"
      | "drained",
    description: parsed.data.description || null,
    isDefault: parsed.data.isDefault,
  });

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteVariant(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteVariantSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid variant ID." };

  await db.delete(foodVariants).where(eq(foodVariants.id, parsed.data.variantId));

  revalidatePath("/review");
  return { ok: true };
}

export async function saveSubstanceValue(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = saveSubstanceValueSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  if (parsed.data.resolvedId) {
    await db
      .update(resolvedSubstanceValues)
      .set({
        valuePer100g: String(parsed.data.valuePer100g),
        confidenceScore: parsed.data.confidenceScore,
        resolvedAt: new Date(),
      })
      .where(eq(resolvedSubstanceValues.id, parsed.data.resolvedId));
  } else {
    await db.insert(resolvedSubstanceValues).values({
      foodVariantId: parsed.data.foodVariantId,
      substanceId: parsed.data.substanceId,
      valuePer100g: String(parsed.data.valuePer100g),
      confidenceScore: parsed.data.confidenceScore,
    });
  }

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteSubstanceValue(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteSubstanceValueSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid ID." };

  await db
    .delete(resolvedSubstanceValues)
    .where(eq(resolvedSubstanceValues.id, parsed.data.resolvedId));

  revalidatePath("/review");
  return { ok: true };
}
