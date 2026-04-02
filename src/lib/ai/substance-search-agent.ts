"use server";

import { finishAiRun, startAiRun } from "@/lib/ai-run-audit";
import { flushLangfuse, getLangfuse } from "@/lib/langfuse";

import { exploreSubstanceSources } from "./explorer-agent";
import { parseDiscoveredSources } from "./parser-agent";

/**
 * Substance Search Agent — orchestrates Explorer + Parser.
 *
 * 1. Explorer finds data sources (USDA API, web pages, research notes)
 * 2. Parser extracts food entries from each source into the DB
 *
 * Returns the count of new foods created.
 */
export async function aiSearchBySubstance(
  substanceId: string,
  userId: string,
): Promise<{ foodIds: string[]; summary: string } | { error: string }> {
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "substance-search-orchestrator",
    userId,
    metadata: { substanceId },
  });

  const aiRun = await startAiRun({
    type: "substance_discovery",
    goal: `Discover foods by substance ${substanceId}`,
    source: "app-search",
    triggerUserId: userId,
    metadata: { substanceId },
  });

  try {
    // Step 1: Explorer finds sources
    const exploreResult = await exploreSubstanceSources(substanceId, userId);

    if ("error" in exploreResult) {
      trace.update({ output: { error: exploreResult.error } });
      await flushLangfuse();
      await finishAiRun(aiRun, {
        status: "failed",
        errorMessage: exploreResult.error,
        resultSummary: `Explorer failed: ${exploreResult.error}`,
        metadata: { substanceId },
      });
      return { error: exploreResult.error };
    }

    if (exploreResult.sources.length === 0) {
      trace.update({ output: { error: "No data sources found" } });
      await flushLangfuse();
      await finishAiRun(aiRun, {
        status: "completed",
        itemCount: 0,
        resultSummary: `No data sources found for ${exploreResult.substanceName}.`,
        metadata: { substanceId, substanceName: exploreResult.substanceName },
      });
      return { error: "Could not find any data sources for this substance. Try uploading a PDF." };
    }

    // Step 2: Parser consumes discovered sources
    const parseResult = await parseDiscoveredSources(exploreResult.sources, substanceId, userId);

    if ("error" in parseResult) {
      trace.update({ output: { error: parseResult.error } });
      await flushLangfuse();
      await finishAiRun(aiRun, {
        status: "failed",
        errorMessage: parseResult.error,
        resultSummary: `Parser failed: ${parseResult.error}`,
        metadata: { substanceId, substanceName: exploreResult.substanceName },
      });
      return { error: parseResult.error };
    }

    // Build summary
    const usdaCount = parseResult.results
      .filter((r) => r.sourceType === "usda_api")
      .reduce((sum, r) => sum + r.created, 0);
    const webCount = parseResult.results
      .filter((r) => r.sourceType !== "usda_api")
      .reduce((sum, r) => sum + r.created, 0);

    const parts: string[] = [];
    if (usdaCount > 0) parts.push(`${usdaCount} from USDA`);
    if (webCount > 0) parts.push(`${webCount} from web sources`);

    const summary =
      parts.length > 0
        ? `Added ${parseResult.totalCreated} foods (${parts.join(", ")}) — pending review`
        : `No new foods found (${parseResult.totalSkipped} already in database)`;

    trace.update({
      output: {
        totalCreated: parseResult.totalCreated,
        totalSkipped: parseResult.totalSkipped,
        summary,
      },
    });
    await flushLangfuse();

    await finishAiRun(aiRun, {
      status: "completed",
      itemCount: parseResult.totalCreated,
      resultSummary: `${exploreResult.substanceName}: ${summary}`,
      metadata: {
        substanceId,
        substanceName: exploreResult.substanceName,
        sourcesFound: exploreResult.sources.length,
        totalCreated: parseResult.totalCreated,
        totalSkipped: parseResult.totalSkipped,
        usdaCount,
        webCount,
      },
    });

    return {
      foodIds: new Array(parseResult.totalCreated).fill("created"),
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    trace.update({ output: { error: errorMessage } });
    await flushLangfuse();

    await finishAiRun(aiRun, {
      status: "failed",
      errorMessage,
      resultSummary: "Substance discovery failed.",
      metadata: { substanceId },
    });

    console.error("AI substance search error:", error);
    return { error: "Failed to discover foods. Please try again." };
  }
}
