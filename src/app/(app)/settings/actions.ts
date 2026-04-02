"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { nutrients } from "@/lib/db/schema/nutrients";
import { profiles, userNutrientLimits } from "@/lib/db/schema/users";
import {
  createCustomNutrientSchema,
  deleteCustomNutrientSchema,
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

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const row = toUserNutrientLimitRow(parsed.data);
  const { limitId, nutrientId } = parsed.data;

  if (limitId) {
    await db
      .update(userNutrientLimits)
      .set({
        dailyLimit: row.daily_limit,
        mode: row.mode as "strict" | "stability",
        rangeMin: row.range_min,
        rangeMax: row.range_max,
      })
      .where(
        and(eq(userNutrientLimits.id, limitId), eq(userNutrientLimits.userId, session.user.id)),
      );

    revalidatePath("/settings");
    return { ok: true };
  }

  const [existing] = await db
    .select({ id: userNutrientLimits.id })
    .from(userNutrientLimits)
    .where(
      and(
        eq(userNutrientLimits.nutrientId, nutrientId),
        eq(userNutrientLimits.userId, session.user.id),
      ),
    )
    .limit(1);

  if (existing?.id) {
    await db
      .update(userNutrientLimits)
      .set({
        dailyLimit: row.daily_limit,
        mode: row.mode as "strict" | "stability",
        rangeMin: row.range_min,
        rangeMax: row.range_max,
      })
      .where(
        and(eq(userNutrientLimits.id, existing.id), eq(userNutrientLimits.userId, session.user.id)),
      );

    revalidatePath("/settings");
    return { ok: true };
  }

  await db.insert(userNutrientLimits).values({
    userId: session.user.id,
    nutrientId,
    dailyLimit: row.daily_limit,
    mode: row.mode as "strict" | "stability",
    rangeMin: row.range_min,
    rangeMax: row.range_max,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function saveProfile(data: {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  healthGoal: string;
  avatarColor: string;
}): Promise<NutrientLimitActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const displayName = [data.firstName, data.lastName].filter(Boolean).join(" ") || null;

  const profileFields = {
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    displayName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    healthGoal: data.healthGoal,
    avatarColor: data.avatarColor,
  };

  // Use UPDATE to avoid overwriting clinicalNotes (which is managed separately).
  // The profile row is created by the handle_new_user trigger on signup.
  const [updated] = await db
    .update(profiles)
    .set(profileFields)
    .where(eq(profiles.id, session.user.id))
    .returning({ id: profiles.id });

  // Fallback: if no row existed (e.g. trigger didn't fire), create it
  if (!updated) {
    await db
      .insert(profiles)
      .values({ id: session.user.id, ...profileFields })
      .onConflictDoNothing();
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/search");
  revalidatePath("/log");
  return { ok: true };
}

export async function saveMedicalNotes(notes: string): Promise<NutrientLimitActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const [updated] = await db
    .update(profiles)
    .set({ clinicalNotes: notes })
    .where(eq(profiles.id, session.user.id))
    .returning({ id: profiles.id });

  if (!updated) {
    await db
      .insert(profiles)
      .values({ id: session.user.id, clinicalNotes: notes })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { clinicalNotes: notes },
      });
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function createCustomNutrient(raw: unknown): Promise<NutrientLimitActionResult> {
  const parsed = createCustomNutrientSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Invalid input." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const slug = parsed.data.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  await db.insert(nutrients).values({
    name: `custom_${slug}_${session.user.id.slice(0, 8)}`,
    displayName: parsed.data.displayName,
    unit: parsed.data.unit,
    sortOrder: 999,
    createdBy: session.user.id,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCustomNutrient(raw: unknown): Promise<NutrientLimitActionResult> {
  const parsed = deleteCustomNutrientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid nutrient id." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  // Only allow deleting user-created nutrients
  await db
    .delete(nutrients)
    .where(and(eq(nutrients.id, parsed.data.nutrientId), eq(nutrients.createdBy, session.user.id)));

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeNutrientLimit(raw: unknown): Promise<NutrientLimitActionResult> {
  const parsed = deleteUserNutrientLimitSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid limit id." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  await db
    .delete(userNutrientLimits)
    .where(
      and(
        eq(userNutrientLimits.id, parsed.data.limitId),
        eq(userNutrientLimits.userId, session.user.id),
      ),
    );

  revalidatePath("/settings");
  return { ok: true };
}
