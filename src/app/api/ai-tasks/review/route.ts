import { NextResponse } from "next/server";

import { executeAiReviewRun } from "@/lib/ai/review-runner";
import { handleCronError, verifyCronAuth } from "@/lib/cron-auth";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";
import { checkCronRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/ai-tasks/review
 * Triggers the AI review agent to verify pending AI-generated observations.
 * Approves plausible values and rejects (+ deletes resolved data for) bad ones.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const rateLimit = await checkCronRateLimit();
  if (rateLimit.limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const run = await startJobRun({
    jobKey: "ai-review-agent",
    source: "cron",
  });

  try {
    const result = await executeAiReviewRun({
      source: "cron",
      jobRunId: run.id,
    });

    await finishJobRun(run, {
      status: "completed",
      message: `Reviewed ${result.totalReviewed} observations`,
      recordsProcessed: result.totalReviewed,
      errorCount: result.errors,
      metadata: {
        totalReviewed: result.totalReviewed,
        approved: result.approved,
        rejected: result.rejected,
        errors: result.errors,
      },
    });

    return NextResponse.json({
      message: `Reviewed ${result.totalReviewed} observations: ${result.approved} approved, ${result.rejected} rejected, ${result.errors} errors`,
      ...result,
    });
  } catch (error) {
    const { message, logged } = handleCronError("AI review agent", error);

    await finishJobRun(run, {
      status: "failed",
      message,
      errorMessage: logged,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
