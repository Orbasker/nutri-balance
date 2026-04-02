import { getSettings } from "./actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          App configuration with database overrides. Values fall back to environment variables and
          built-in defaults when not set in the database.
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
