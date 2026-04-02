"use server";

import { revalidatePath } from "next/cache";

import { and, eq, inArray } from "drizzle-orm";

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

export async function saveMedicalNotes(notes: string): Promise<SubstanceLimitActionResult> {
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
    name: `community_${slug}`,
    displayName: parsed.data.displayName,
    unit: parsed.data.unit,
    category: parsed.data.category ?? "other",
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

export async function bulkEnableSubstances(
  items: Array<{ substanceName: string; dailyLimit: number; mode: "strict" | "stability" }>,
): Promise<SubstanceLimitActionResult> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const names = items.map((i) => i.substanceName);
  const matchedSubstances = await db
    .select({ id: substances.id, name: substances.name })
    .from(substances)
    .where(inArray(substances.name, names));

  const nameToId = new Map(matchedSubstances.map((s) => [s.name, s.id]));

  // Get existing limits to avoid duplicates
  const existingLimits = await db
    .select({ substanceId: userSubstanceLimits.substanceId })
    .from(userSubstanceLimits)
    .where(eq(userSubstanceLimits.userId, session.user.id));
  const existingSet = new Set(existingLimits.map((l) => l.substanceId));

  const toInsert = items
    .map((item) => {
      const substanceId = nameToId.get(item.substanceName);
      if (!substanceId || existingSet.has(substanceId)) return null;
      return {
        userId: session.user.id,
        substanceId,
        dailyLimit: String(item.dailyLimit),
        mode: item.mode as "strict" | "stability",
        rangeMin: null,
        rangeMax: null,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (toInsert.length > 0) {
    await db.insert(userSubstanceLimits).values(toInsert);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
