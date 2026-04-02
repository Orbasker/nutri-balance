import { eq, isNull, or } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { substances } from "@/lib/db/schema/substances";
import { profiles, userSubstanceLimits } from "@/lib/db/schema/users";

import { LogoutButton } from "./logout-button";
import { ProfileSettings } from "./profile-settings";
import { SubstanceLimitsSettings } from "./substance-limits-settings";

export default async function SettingsPage() {
  const session = await getSession();

  const [allSubstances, limits, profile] = await Promise.all([
    db
      .select({
        id: substances.id,
        name: substances.name,
        unit: substances.unit,
        display_name: substances.displayName,
        sort_order: substances.sortOrder,
        created_by: substances.createdBy,
      })
      .from(substances)
      .where(or(isNull(substances.createdBy), eq(substances.createdBy, session!.user.id)))
      .orderBy(substances.sortOrder),
    db.select().from(userSubstanceLimits).where(eq(userSubstanceLimits.userId, session!.user.id)),
    db
      .select({
        first_name: profiles.firstName,
        last_name: profiles.lastName,
        display_name: profiles.displayName,
        date_of_birth: profiles.dateOfBirth,
        gender: profiles.gender,
        clinical_notes: profiles.clinicalNotes,
        health_goal: profiles.healthGoal,
        avatar_color: profiles.avatarColor,
      })
      .from(profiles)
      .where(eq(profiles.id, session!.user.id))
      .then((rows) => rows[0] ?? null),
  ]);

  // Map limits to the format expected by the component
  const mappedLimits = limits.map((l) => ({
    id: l.id,
    user_id: l.userId,
    substance_id: l.substanceId,
    daily_limit: l.dailyLimit,
    mode: l.mode,
    range_min: l.rangeMin,
    range_max: l.rangeMax,
  }));

  return (
    <div className="max-w-screen-md mx-auto px-6 pt-4 pb-12">
      <div className="mb-10">
        <h2 className="font-extrabold text-3xl text-md-primary tracking-tight mb-2">Settings</h2>
        <p className="text-md-on-surface-variant font-medium">
          Customize your clinical goals and tracked substances.
        </p>
      </div>

      <ProfileSettings
        firstName={profile?.first_name ?? ""}
        lastName={profile?.last_name ?? ""}
        dateOfBirth={profile?.date_of_birth ?? ""}
        gender={profile?.gender ?? ""}
        healthGoal={profile?.health_goal ?? ""}
        avatarColor={profile?.avatar_color ?? "blue"}
      />

      <div className="mt-8" />

      <SubstanceLimitsSettings
        substances={allSubstances ?? []}
        limits={mappedLimits ?? []}
        medicalNotes={profile?.clinical_notes ?? ""}
      />

      <div className="mt-12 pt-8 border-t border-md-outline-variant/30">
        <h3 className="font-bold text-lg text-md-on-surface mb-1">Account</h3>
        <p className="text-sm text-md-on-surface-variant mb-4">
          Signed in as {session!.user.email}
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
