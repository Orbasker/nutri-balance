"use server";

import { generateText, stepCountIs, tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema/foods";
import { substances } from "@/lib/db/schema/substances";
import { flushLangfuse, getLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";
import {
  type USDASearchResponse,
  normalizeUSDAUnit,
  searchFoodByName,
  searchFoodsBySubstance,
} from "@/lib/usda-api";

/**
 * A discovered data source — URL, raw text, or structured data the parser can consume.
 */
export interface DiscoveredSource {
  type: "usda_api" | "web_page" | "raw_text";
  title: string;
  url?: string;
  /** For USDA API results, the structured response */
  usdaData?: USDASearchResponse;
  /** For web pages, the fetched text content */
  textContent?: string;
  /** How many food entries this source likely contains */
  estimatedEntries: number;
  /** Confidence that data is reliable (0-100) */
  reliability: number;
}

export interface ExplorerResult {
  sources: DiscoveredSource[];
  substanceName: string;
  substanceId: string;
  summary: string;
}

/**
 * Explorer Agent — discovers data sources for a given substance.
 *
 * Strategy:
 * 1. Always queries USDA FoodData Central API (free, high reliability)
 * 2. Uses AI with web fetch tool to find additional sources (PDFs, databases, reports)
 * 3. Returns all discovered sources for the Parser Agent to consume
 *
 * Does NOT write to DB — that's the parser's job.
 */
export async function exploreSubstanceSources(
  substanceId: string,
  userId: string,
): Promise<ExplorerResult | { error: string }> {
  const [substance] = await db
    .select()
    .from(substances)
    .where(eq(substances.id, substanceId))
    .limit(1);

  if (!substance) return { error: "Substance not found." };

  const existingFoods = await db.select({ name: foods.name }).from(foods);
  const existingNames = existingFoods.map((f) => f.name.toLowerCase());

  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "explorer-agent",
    userId,
    metadata: { substanceId, substanceName: substance.displayName },
  });

  const discoveredSources: DiscoveredSource[] = [];

  // ── Source 1: USDA FoodData Central API ──
  try {
    const usdaSpan = trace.span({ name: "usda-api-explore" });

    // Fetch pages sequentially to avoid rate limiting (DEMO_KEY: 30 req/hour)
    const page1 = await searchFoodsBySubstance(substance.displayName, {
      pageSize: 50,
      pageNumber: 1,
    });
    const page2 = await searchFoodsBySubstance(substance.displayName, {
      pageSize: 50,
      pageNumber: 2,
    });

    const totalFoods = page1.foods.length + page2.foods.length;

    usdaSpan.end({
      output: { totalHits: page1.totalHits, fetched: totalFoods },
    });

    if (page1.foods.length > 0) {
      discoveredSources.push({
        type: "usda_api",
        title: `USDA FoodData Central — ${substance.displayName} (page 1)`,
        url: "https://fdc.nal.usda.gov",
        usdaData: page1,
        estimatedEntries: page1.foods.length,
        reliability: 95,
      });
    }

    if (page2.foods.length > 0) {
      discoveredSources.push({
        type: "usda_api",
        title: `USDA FoodData Central — ${substance.displayName} (page 2)`,
        url: "https://fdc.nal.usda.gov",
        usdaData: page2,
        estimatedEntries: page2.foods.length,
        reliability: 95,
      });
    }
  } catch (error) {
    console.warn("USDA API exploration failed:", error);
    trace.span({ name: "usda-api-error" }).end({
      output: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // ── Source 2: AI-powered web exploration ──
  try {
    const model = getModel();
    const modelName = typeof model === "string" ? model : model.modelId;

    const aiSpan = trace.generation({
      name: "ai-web-explore",
      model: modelName,
      input: { substance: substance.displayName },
    });

    const { text, toolResults, usage } = await generateText({
      model,
      stopWhen: stepCountIs(5),
      tools: {
        fetchWebPage: tool({
          description:
            "Fetch the text content of a web page URL. Use this to grab nutrition data from websites, government databases, or reports.",
          inputSchema: z.object({
            url: z.string().url().describe("The URL to fetch"),
            reason: z.string().describe("Why this URL is useful for substance data"),
          }),
          execute: async (input: { url: string; reason: string }) => {
            try {
              const response = await fetch(input.url, {
                headers: {
                  "User-Agent": "NutriBalance/1.0 (nutrition research)",
                  Accept: "text/html,text/plain,application/json",
                },
                signal: AbortSignal.timeout(10000),
              });

              if (!response.ok) {
                return { error: `HTTP ${response.status}`, url: input.url };
              }

              const contentType = response.headers.get("content-type") ?? "";

              // Skip PDFs and binary — we can't parse these inline
              if (contentType.includes("pdf") || contentType.includes("octet-stream")) {
                return {
                  type: "pdf_url" as const,
                  url: input.url,
                  reason: input.reason,
                  note: "This is a PDF — user can download and upload it via the PDF import feature",
                };
              }

              const bodyText = await response.text();
              // Truncate to avoid overwhelming context
              const truncated = bodyText.slice(0, 15000);
              return { url: input.url, reason: input.reason, content: truncated, contentType };
            } catch (err) {
              return {
                error: err instanceof Error ? err.message : "Fetch failed",
                url: input.url,
              };
            }
          },
        }),
        searchUSDA: tool({
          description:
            "Search USDA FoodData Central for foods by name. Returns substance profiles.",
          inputSchema: z.object({
            foodName: z.string().describe("Food name to search, e.g. 'kale' or 'chicken breast'"),
          }),
          execute: async (input: { foodName: string }) => {
            try {
              const result = await searchFoodByName(input.foodName, { pageSize: 3 });
              return {
                foods: result.foods.map((f) => ({
                  name: f.description,
                  fdcId: f.fdcId,
                  substances: f.foodSubstances
                    ?.filter((n) => n.value > 0)
                    .slice(0, 20)
                    .map((n) => ({
                      name: n.substanceName,
                      value: n.value,
                      unit: normalizeUSDAUnit(n.unitName),
                    })),
                })),
              };
            } catch (err) {
              return { error: err instanceof Error ? err.message : "USDA search failed" };
            }
          },
        }),
      },
      prompt: `You are a nutrition data explorer. Your job is to find data sources containing foods rich in ${substance.displayName} (${substance.unit}).

ALREADY IN DATABASE (${existingNames.length} foods): ${existingNames.slice(0, 50).join(", ")}${existingNames.length > 50 ? "..." : ""}

Your goals:
1. Use the searchUSDA tool to find specific foods rich in ${substance.displayName} that are NOT in our database
2. Use fetchWebPage to find nutrition data pages with comprehensive lists
3. Focus on finding REAL data with measured values, not general articles

Good sources to try:
- USDA-specific food searches for foods known to be rich in ${substance.displayName}
- Government nutrition databases
- NIH Office of Dietary Supplements fact sheets

Report what you found — list all URLs with useful data, especially any PDFs the user could upload.`,
    });

    aiSpan.end({
      output: { toolCalls: toolResults?.length ?? 0, textLength: text.length },
      usage: usage
        ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
        : undefined,
    });

    if (usage) {
      await recordAiUsageEvent({
        feature: "explorer-agent",
        operation: "ai-web-explore",
        model: modelName,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
        metadata: {
          substance: substance.displayName,
          toolCalls: toolResults?.length ?? 0,
        },
      });
    }

    // Process tool results into discovered sources
    if (toolResults) {
      for (const toolResult of toolResults) {
        const output = toolResult.output as Record<string, unknown> | undefined;
        if (!output) continue;

        if (output.type === "pdf_url" && typeof output.url === "string") {
          discoveredSources.push({
            type: "web_page",
            title: `PDF: ${typeof output.reason === "string" ? output.reason : "Nutrition data PDF"}`,
            url: output.url,
            estimatedEntries: 50,
            reliability: 80,
          });
        } else if (typeof output.content === "string" && typeof output.url === "string") {
          discoveredSources.push({
            type: "web_page",
            title: typeof output.reason === "string" ? output.reason : "Web nutrition data",
            url: output.url,
            textContent: output.content,
            estimatedEntries: 20,
            reliability: 70,
          });
        }
      }
    }

    // Add the AI's text summary as context
    if (text.trim()) {
      discoveredSources.push({
        type: "raw_text",
        title: "AI research notes",
        textContent: text,
        estimatedEntries: 0,
        reliability: 60,
      });
    }
  } catch (error) {
    console.warn("AI exploration failed:", error);
    trace.span({ name: "ai-explore-error" }).end({
      output: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const totalEstimated = discoveredSources.reduce((sum, s) => sum + s.estimatedEntries, 0);

  const summary = [
    `Found ${discoveredSources.length} data source${discoveredSources.length !== 1 ? "s" : ""}`,
    `for ${substance.displayName}`,
    totalEstimated > 0 ? `(~${totalEstimated} potential food entries)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  trace.update({
    output: {
      sourcesFound: discoveredSources.length,
      estimatedEntries: totalEstimated,
    },
  });
  await flushLangfuse();

  return {
    sources: discoveredSources,
    substanceName: substance.displayName,
    substanceId: substance.id,
    summary,
  };
}
