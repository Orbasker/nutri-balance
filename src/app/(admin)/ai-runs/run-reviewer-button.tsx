"use client";

import { useActionState } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { runReviewerNow } from "./actions";

export function RunReviewerButton() {
  const [state, runAction, isPending] = useActionState(async () => runReviewerNow(), null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={() => runAction()} disabled={isPending}>
        <RefreshCw className={isPending ? "animate-spin" : ""} />
        {isPending ? "Running reviewer..." : "Run Reviewer Now"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
    </div>
  );
}
