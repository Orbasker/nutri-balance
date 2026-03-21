"use server";

import { revalidatePath } from "next/cache";

import type { AdminFoodDetail, AdminFoodListItem, AdminFoodVariant, NutrientOption } from "@/types";
import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addVariantSchema,
  createFoodSchema,
  deleteFoodSchema,
  deleteNutrientValueSchema,
  deleteVariantSchema,
  saveNutrientValueSchema,
  updateFoodSchema,
} from "@/lib/validators";

export type AdminActionResult = { ok: true } | { error: string };

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
      resolvedId: resolvedNutrientValues.id,
      nutrientId: nutrients.id,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      nutrientUnit: nutrients.unit,
      valuePer100g: resolvedNutrientValues.valuePer100g,
      confidenceScore: resolvedNutrientValues.confidenceScore,
    })
    .from(foods)
    .leftJoin(foodVariants, eq(foodVariants.foodId, foods.id))
    .leftJoin(resolvedNutrientValues, eq(resolvedNutrientValues.foodVariantId, foodVariants.id))
    .leftJoin(nutrients, eq(nutrients.id, resolvedNutrientValues.nutrientId))
    .where(eq(foods.id, foodId))
    .orderBy(foodVariants.preparationMethod, nutrients.sortOrder);

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
        nutrients: [],
      };
      variantMap.set(row.variantId, variant);
    }

    if (
      row.resolvedId &&
      row.nutrientId &&
      !variant.nutrients.some((n) => n.resolvedId === row.resolvedId)
    ) {
      variant.nutrients.push({
        resolvedId: row.resolvedId,
        nutrientId: row.nutrientId,
        nutrientName: row.nutrientName!,
        nutrientDisplayName: row.nutrientDisplayName!,
        nutrientUnit: row.nutrientUnit!,
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

export async function getAllNutrients(): Promise<NutrientOption[]> {
  const rows = await db
    .select({
      id: nutrients.id,
      name: nutrients.name,
      displayName: nutrients.displayName,
      unit: nutrients.unit,
    })
    .from(nutrients)
    .orderBy(nutrients.sortOrder);

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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("foods")
    .insert({
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true, foodId: data.id };
}

export async function updateFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = updateFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("foods")
    .update({
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.foodId);

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteFood(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteFoodSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid food ID." };

  const admin = createAdminClient();
  const { error } = await admin.from("foods").delete().eq("id", parsed.data.foodId);

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true };
}

export async function addVariant(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = addVariantSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("food_variants").insert({
    food_id: parsed.data.foodId,
    preparation_method: parsed.data.preparationMethod,
    description: parsed.data.description || null,
    is_default: parsed.data.isDefault,
  });

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteVariant(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteVariantSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid variant ID." };

  const admin = createAdminClient();
  const { error } = await admin.from("food_variants").delete().eq("id", parsed.data.variantId);

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true };
}

export async function saveNutrientValue(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = saveNutrientValueSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();

  if (parsed.data.resolvedId) {
    // Update existing
    const { error } = await admin
      .from("resolved_nutrient_values")
      .update({
        value_per_100g: String(parsed.data.valuePer100g),
        confidence_score: parsed.data.confidenceScore,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.resolvedId);

    if (error) return { error: error.message };
  } else {
    // Insert new
    const { error } = await admin.from("resolved_nutrient_values").insert({
      food_variant_id: parsed.data.foodVariantId,
      nutrient_id: parsed.data.nutrientId,
      value_per_100g: String(parsed.data.valuePer100g),
      confidence_score: parsed.data.confidenceScore,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/review");
  return { ok: true };
}

export async function deleteNutrientValue(raw: unknown): Promise<AdminActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Unauthorized." };

  const parsed = deleteNutrientValueSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("resolved_nutrient_values")
    .delete()
    .eq("id", parsed.data.resolvedId);

  if (error) return { error: error.message };

  revalidatePath("/review");
  return { ok: true };
}
