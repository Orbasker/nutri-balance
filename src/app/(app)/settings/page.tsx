import { createClient } from "@/lib/supabase/server";

import { NutrientLimitsSettings } from "./nutrient-limits-settings";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: nutrients, error: nutrientsError }, { data: limits, error: limitsError }] =
    await Promise.all([
      supabase
        .from("nutrients")
        .select("id, name, unit, display_name, sort_order")
        .order("sort_order", {
          ascending: true,
        }),
      supabase.from("user_nutrient_limits").select("*"),
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

      <NutrientLimitsSettings nutrients={nutrients ?? []} limits={limits ?? []} />
    </div>
  );
}
