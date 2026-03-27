import { NextResponse } from "next/server";

import { runAiReview } from "@/lib/ai/review-agent";

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

  try {
    const result = await runAiReview();

    return NextResponse.json({
      message: `Reviewed ${result.totalReviewed} observations: ${result.approved} approved, ${result.rejected} rejected, ${result.errors} errors`,
      ...result,
    });
  } catch (error) {
    console.error("AI review agent error:", error);
    return NextResponse.json(
      {
        error: "Review agent failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
