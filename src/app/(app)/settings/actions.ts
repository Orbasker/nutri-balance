"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { substances } from "@/lib/db/schema/substances";
import { profiles, userSubstanceLimits } from "@/lib/db/schema/users";
import {
  createCustomSubstanceSchema,
  deleteCustomSubstanceSchema,
  deleteUserSubstanceLimitSchema,
  saveUserSubstanceLimitSchema,
  toUserSubstanceLimitRow,
} from "@/lib/validators";

export type SubstanceLimitActionResult = { ok: true } | { error: string };

export async function saveSubstanceLimit(raw: unknown): Promise<SubstanceLimitActionResult> {
  const parsed = saveUserSubstanceLimitSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Invalid input." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  const row = toUserSubstanceLimitRow(parsed.data);
  const { limitId, substanceId } = parsed.data;

  if (limitId) {
    await db
      .update(userSubstanceLimits)
      .set({
        dailyLimit: row.daily_limit,
        mode: row.mode as "strict" | "stability",
        rangeMin: row.range_min,
        rangeMax: row.range_max,
      })
      .where(
        and(eq(userSubstanceLimits.id, limitId), eq(userSubstanceLimits.userId, session.user.id)),
      );

    revalidatePath("/settings");
    return { ok: true };
  }

  const [existing] = await db
    .select({ id: userSubstanceLimits.id })
    .from(userSubstanceLimits)
    .where(
      and(
        eq(userSubstanceLimits.substanceId, substanceId),
        eq(userSubstanceLimits.userId, session.user.id),
      ),
    )
    .limit(1);

  if (existing?.id) {
    await db
      .update(userSubstanceLimits)
      .set({
        dailyLimit: row.daily_limit,
        mode: row.mode as "strict" | "stability",
        rangeMin: row.range_min,
        rangeMax: row.range_max,
      })
      .where(
        and(
          eq(userSubstanceLimits.id, existing.id),
          eq(userSubstanceLimits.userId, session.user.id),
        ),
      );

    revalidatePath("/settings");
    return { ok: true };
  }

  await db.insert(userSubstanceLimits).values({
    userId: session.user.id,
    substanceId,
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
}): Promise<SubstanceLimitActionResult> {
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

export async function saveMedicalNotes(notes: string): Promise<SubstanceLimitActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  await db.update(profiles).set({ clinicalNotes: notes }).where(eq(profiles.id, session.user.id));

  revalidatePath("/settings");
  return { ok: true };
}

export async function createCustomSubstance(raw: unknown): Promise<SubstanceLimitActionResult> {
  const parsed = createCustomSubstanceSchema.safeParse(raw);
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

  await db.insert(substances).values({
    name: `custom_${slug}_${session.user.id.slice(0, 8)}`,
    displayName: parsed.data.displayName,
    unit: parsed.data.unit,
    sortOrder: 999,
    createdBy: session.user.id,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCustomSubstance(raw: unknown): Promise<SubstanceLimitActionResult> {
  const parsed = deleteCustomSubstanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid substance id." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  // Only allow deleting user-created substances
  await db
    .delete(substances)
    .where(
      and(eq(substances.id, parsed.data.substanceId), eq(substances.createdBy, session.user.id)),
    );

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeSubstanceLimit(raw: unknown): Promise<SubstanceLimitActionResult> {
  const parsed = deleteUserSubstanceLimitSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid limit id." };
  }

  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." };
  }

  await db
    .delete(userSubstanceLimits)
    .where(
      and(
        eq(userSubstanceLimits.id, parsed.data.limitId),
        eq(userSubstanceLimits.userId, session.user.id),
      ),
    );

  revalidatePath("/settings");
  return { ok: true };
}
