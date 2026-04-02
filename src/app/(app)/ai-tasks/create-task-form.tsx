"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { createAiTask } from "./actions";

interface Substance {
  id: string;
  name: string;
  displayName: string;
  unit: string;
}

export function CreateTaskForm({ substances }: { substances: Substance[] }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const substanceId = formData.get("substanceId") as string;
      if (!substanceId) return { error: "Please select a substance." };
      const result = await createAiTask(substanceId);
      if ("error" in result) return { error: result.error };
      return { ok: true };
    },
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Research Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="substanceId" className="mb-1 block text-sm font-medium">
              Substance to research
            </label>
            <select
              id="substanceId"
              name="substanceId"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a substance…</option>
              {substances.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.displayName} ({n.unit})
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create Task"}
          </Button>
        </form>
        {state?.error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="mt-2 text-sm text-[#00531c] dark:text-[#68f47f]">
            Task created. You can run it below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
