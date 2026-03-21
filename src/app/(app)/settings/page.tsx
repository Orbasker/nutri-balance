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
      <div className="container mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-destructive mt-4 text-sm" role="alert">
          {nutrientsError?.message ?? limitsError?.message ?? "Could not load settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-8">
        <NutrientLimitsSettings nutrients={nutrients ?? []} limits={limits ?? []} />
      </div>
    </div>
  );
}
