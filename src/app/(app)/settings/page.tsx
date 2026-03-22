import { createClient } from "@/lib/supabase/server";

import { LogoutButton } from "./logout-button";
import { NutrientLimitsSettings } from "./nutrient-limits-settings";
import { ProfileSettings } from "./profile-settings";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: nutrients, error: nutrientsError },
    { data: limits, error: limitsError },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("nutrients")
      .select("id, name, unit, display_name, sort_order")
      .order("sort_order", {
        ascending: true,
      }),
    supabase.from("user_nutrient_limits").select("*"),
    supabase
      .from("profiles")
      .select(
        "first_name, last_name, display_name, date_of_birth, gender, clinical_notes, health_goal, avatar_color",
      )
      .eq("id", user!.id)
      .single(),
  ]);

  if (nutrientsError || limitsError) {
    return (
      <div className="px-6 max-w-screen-md mx-auto pt-4">
        <h2 className="font-extrabold text-3xl text-md-primary tracking-tight mb-2">Settings</h2>
        <p className="text-md-error mt-4 text-sm" role="alert">
          {nutrientsError?.message ?? limitsError?.message ?? "Could not load settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-md mx-auto px-6 pt-4 pb-12">
      <div className="mb-10">
        <h2 className="font-extrabold text-3xl text-md-primary tracking-tight mb-2">Settings</h2>
        <p className="text-md-on-surface-variant font-medium">
          Customize your clinical goals and tracker behavior.
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

      <NutrientLimitsSettings
        nutrients={nutrients ?? []}
        limits={limits ?? []}
        medicalNotes={profile?.clinical_notes ?? ""}
      />

      <div className="mt-12 pt-8 border-t border-md-outline-variant/30">
        <h3 className="font-bold text-lg text-md-on-surface mb-1">Account</h3>
        <p className="text-sm text-md-on-surface-variant mb-4">Signed in as {user!.email}</p>
        <LogoutButton />
      </div>
    </div>
  );
}
