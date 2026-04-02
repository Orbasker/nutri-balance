"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { RotateCcw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { SettingsData } from "./actions";
import { resetSetting, updateSetting } from "./actions";

function isJsonObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

const SOURCE_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  database: { label: "Database", variant: "default" },
  env: { label: "Env var", variant: "secondary" },
  default: { label: "Built-in default", variant: "outline" },
  unset: { label: "Not set", variant: "outline" },
};

function SettingRow({ configKey, entry }: { configKey: string; entry: SettingsData[string] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editValue, setEditValue] = useState(() => formatValue(entry.value));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = editValue !== formatValue(entry.value);
  const useTextarea = isJsonObject(entry.value) || editValue.includes("\n");

  const sourceInfo = SOURCE_LABELS[entry.source] ?? SOURCE_LABELS.unset;

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSetting(configKey, editValue);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  function handleReset() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await resetSetting(configKey);
      if ("error" in result) {
        setError(result.error);
      } else {
        setEditValue("");
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{entry.label}</CardTitle>
              <Badge variant={sourceInfo.variant}>{sourceInfo.label}</Badge>
              {success && <Badge variant="default">Saved</Badge>}
            </div>
            <CardDescription>{entry.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {entry.source === "database" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isPending}
                title="Revert to env var default"
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isPending || !isDirty}>
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {useTextarea ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="min-h-[100px] font-mono text-sm"
            placeholder="Enter value (JSON or plain text). Leave empty to unset."
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="font-mono text-sm"
            placeholder="Enter value. Leave empty to unset."
          />
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function SettingsForm({ settings }: { settings: SettingsData }) {
  const keys = Object.keys(settings);

  if (keys.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground">No configurable settings found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <SettingRow key={key} configKey={key} entry={settings[key]} />
      ))}
    </div>
  );
}
