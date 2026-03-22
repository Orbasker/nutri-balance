"use server";

import { flushLangfuse, getLangfuse } from "@/lib/langfuse";

import { exploreNutrientSources } from "./explorer-agent";
import { parseDiscoveredSources } from "./parser-agent";

/**
 * Nutrient Search Agent — orchestrates Explorer + Parser.
 *
 * 1. Explorer finds data sources (USDA API, web pages, research notes)
 * 2. Parser extracts food entries from each source into the DB
 *
 * Returns the count of new foods created.
 */
export async function aiSearchByNutrient(
  nutrientId: string,
  userId: string,
): Promise<{ foodIds: string[]; summary: string } | { error: string }> {
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "nutrient-search-orchestrator",
    userId,
    metadata: { nutrientId },
  });

  // Step 1: Explorer finds sources
  const exploreResult = await exploreNutrientSources(nutrientId, userId);

  if ("error" in exploreResult) {
    trace.update({ output: { error: exploreResult.error } });
    await flushLangfuse();
    return { error: exploreResult.error };
  }

  if (exploreResult.sources.length === 0) {
    trace.update({ output: { error: "No data sources found" } });
    await flushLangfuse();
    return { error: "Could not find any data sources for this nutrient. Try uploading a PDF." };
  }

  // Step 2: Parser consumes discovered sources
  const parseResult = await parseDiscoveredSources(exploreResult.sources, nutrientId, userId);

  if ("error" in parseResult) {
    trace.update({ output: { error: parseResult.error } });
    await flushLangfuse();
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

  // Collect created food IDs — we don't track them individually from parser,
  // so return the count-based info
  trace.update({
    output: {
      totalCreated: parseResult.totalCreated,
      totalSkipped: parseResult.totalSkipped,
      summary,
    },
  });
  await flushLangfuse();

  // The caller uses count, not individual IDs
  return {
    foodIds: new Array(parseResult.totalCreated).fill("created"),
    summary,
  };
}
