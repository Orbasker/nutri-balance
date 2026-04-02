import { finishAiRun, startAiRun } from "@/lib/ai-run-audit";
import { type ReviewResult, runAiReview } from "@/lib/ai/review-agent";

export async function executeAiReviewRun(input: {
  source: string;
  triggerUserId?: string | null;
  jobRunId?: string | null;
}): Promise<ReviewResult> {
  const aiRun = await startAiRun({
    type: "ai_review",
    goal: "Review pending AI observations",
    source: input.source,
    triggerUserId: input.triggerUserId ?? null,
  });

  try {
    const result = await runAiReview({
      source: input.source,
      jobRunId: input.jobRunId ?? undefined,
      aiRunId: aiRun.id,
    });

    await finishAiRun(aiRun, {
      status: "completed",
      itemCount: result.totalReviewed,
      resultSummary:
        result.totalReviewed === 0
          ? "No pending AI observations to review."
          : `Reviewed ${result.totalReviewed} observations: ${result.approved} approved, ${result.rejected} rejected.`,
      metadata: {
        approved: result.approved,
        rejected: result.rejected,
        errors: result.errors,
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await finishAiRun(aiRun, {
      status: "failed",
      errorMessage,
      resultSummary: "AI review failed.",
    });

    throw error;
  }
}
