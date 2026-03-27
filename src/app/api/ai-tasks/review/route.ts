import { NextResponse } from "next/server";

import { runAiReview } from "@/lib/ai/review-agent";
import { finishJobRun, startJobRun } from "@/lib/ops-monitoring";

/**
 * POST /api/ai-tasks/review
 * Triggers the AI review agent to verify pending AI-generated observations.
 * Approves plausible values and rejects (+ deletes resolved data for) bad ones.
 * Protected by CRON_SECRET header.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await startJobRun({
    jobKey: "ai-review-agent",
    source: "cron",
  });

  try {
    const result = await runAiReview({ jobRunId: run.id });

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
    console.error("AI review agent error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await finishJobRun(run, {
      status: "failed",
      message: "AI review agent failed",
      errorMessage,
    });

    return NextResponse.json(
      {
        error: "Review agent failed",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
