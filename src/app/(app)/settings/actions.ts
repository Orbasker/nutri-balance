"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles, userNutrientLimits } from "@/lib/db/schema/users";
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

  await db
    .insert(profiles)
    .values({
      id: session.user.id,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      displayName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      healthGoal: data.healthGoal,
      avatarColor: data.avatarColor,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        displayName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        healthGoal: data.healthGoal,
        avatarColor: data.avatarColor,
      },
    });

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

  await db.update(profiles).set({ clinicalNotes: notes }).where(eq(profiles.id, session.user.id));

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
