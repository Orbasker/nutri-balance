"use server";

import { generateObject } from "ai";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import {
  evidenceItems,
  nutrientObservations,
  sourceRecords,
  sources,
} from "@/lib/db/schema/observations";
import { resolvedNutrientValues } from "@/lib/db/schema/reviews";
import { flushLangfuse, getLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";

import type { DiscoveredSource } from "./explorer-agent";

const VALID_PREP_METHODS = [
  "raw",
  "boiled",
  "steamed",
  "grilled",
  "baked",
  "fried",
  "roasted",
  "sauteed",
  "poached",
  "blanched",
  "drained",
] as const;

type PrepMethod = (typeof VALID_PREP_METHODS)[number];

const parsedFoodEntrySchema = z.object({
  name: z.string().describe("Food name"),
  category: z
    .enum([
      "vegetable",
      "fruit",
      "protein",
      "grain",
      "dairy",
      "legume",
      "nut",
      "oil",
      "spice",
      "other",
    ])
    .describe("Food category"),
  valuePer100g: z.number().nonnegative().describe("Nutrient value per 100g"),
  confidence: z.number().min(0).max(100).describe("Data confidence 0-100"),
  preparationMethod: z.string().describe("raw, boiled, steamed, etc."),
  evidence: z.string().describe("Source/citation for this data point"),
  sourceUrl: z.string().optional().describe("URL if available"),
});

const parseResultSchema = z.object({
  foods: z.array(parsedFoodEntrySchema).describe("ALL food entries extracted from the source data"),
});

export interface ParserResult {
  created: number;
  skipped: number;
  sourceType: string;
}

async function getOrCreateSource(
  name: string,
  type: "government_db" | "ai_generated" | "scientific_paper" | "user_submission",
  trustLevel: number,
  url?: string,
): Promise<string> {
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.name, name))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(sources)
    .values({ name, type, trustLevel, url: url ?? null })
    .returning({ id: sources.id });

  return created.id;
}

/**
 * Insert a single food entry into the database with a nutrient observation.
 * Returns the food ID if created, null if skipped.
 */
async function insertFoodEntry(
  entry: z.infer<typeof parsedFoodEntrySchema>,
  nutrientId: string,
  nutrientUnit: string,
  sourceId: string,
  sourceName: string,
  sourceUrl?: string,
): Promise<string | null> {
  // Check if food already exists
  const existing = await db
    .select({ id: foods.id })
    .from(foods)
    .where(ilike(foods.name, entry.name))
    .limit(1);

  if (existing[0]) return null; // skip duplicates

  const prepMethod: PrepMethod = VALID_PREP_METHODS.includes(entry.preparationMethod as PrepMethod)
    ? (entry.preparationMethod as PrepMethod)
    : "raw";

  const [food] = await db
    .insert(foods)
    .values({ name: entry.name, category: entry.category || null })
    .returning({ id: foods.id });

  const [fv] = await db
    .insert(foodVariants)
    .values({
      foodId: food.id,
      preparationMethod: prepMethod,
      isDefault: true,
    })
    .returning({ id: foodVariants.id });

  await db.insert(servingMeasures).values({
    foodVariantId: fv.id,
    label: "per 100g",
    gramsEquivalent: "100",
  });

  const [record] = await db
    .insert(sourceRecords)
    .values({ sourceId, rawData: entry })
    .returning({ id: sourceRecords.id });

  const confidenceScore = Math.min(entry.confidence, 95);
  const derivationType = entry.confidence >= 85 ? "analytical" : "ai_extracted";

  const [observation] = await db
    .insert(nutrientObservations)
    .values({
      foodVariantId: fv.id,
      nutrientId,
      value: String(entry.valuePer100g),
      unit: nutrientUnit,
      basisAmount: "100",
      basisUnit: "g",
      sourceRecordId: record.id,
      derivationType: derivationType as "analytical" | "ai_extracted",
      confidenceScore,
      reviewStatus: "pending",
    })
    .returning({ id: nutrientObservations.id });

  await db.insert(evidenceItems).values({
    observationId: observation.id,
    snippet: entry.evidence,
    url: entry.sourceUrl ?? sourceUrl ?? null,
  });

  const confidenceLabel =
    confidenceScore >= 85
      ? "High confidence"
      : confidenceScore >= 70
        ? "Good confidence"
        : confidenceScore >= 50
          ? "Moderate"
          : "Low";

  await db.insert(resolvedNutrientValues).values({
    foodVariantId: fv.id,
    nutrientId,
    valuePer100g: String(entry.valuePer100g),
    confidenceScore,
    confidenceLabel,
    sourceSummary: sourceName,
  });

  return food.id;
}

/**
 * Parse USDA API results directly — no AI needed, these are structured.
 */
async function parseUSDASource(
  source: DiscoveredSource,
  nutrientId: string,
  nutrientName: string,
  nutrientUnit: string,
): Promise<ParserResult> {
  if (!source.usdaData?.foods?.length) {
    return { created: 0, skipped: 0, sourceType: "usda_api" };
  }

  const sourceId = await getOrCreateSource(
    "USDA FoodData Central",
    "government_db",
    95,
    "https://fdc.nal.usda.gov",
  );

  let created = 0;
  let skipped = 0;

  for (const usdaFood of source.usdaData.foods) {
    // Find the target nutrient in this food's data
    const nutrientData = usdaFood.foodNutrients?.find((fn) => {
      const fnName = fn.nutrientName?.toLowerCase() ?? "";
      const target = nutrientName.toLowerCase();
      return fnName.includes(target) || target.includes(fnName.split("(")[0].trim().toLowerCase());
    });

    if (!nutrientData || nutrientData.value <= 0) {
      skipped++;
      continue;
    }

    // Clean the name: "Spinach, raw" → "Spinach"
    const name = usdaFood.description.split(",")[0].trim();
    const prepLower = usdaFood.description.toLowerCase();
    let prep = "raw";
    if (prepLower.includes("cooked") || prepLower.includes("boiled")) prep = "boiled";
    else if (prepLower.includes("steamed")) prep = "steamed";
    else if (prepLower.includes("fried")) prep = "fried";
    else if (prepLower.includes("roasted")) prep = "roasted";
    else if (prepLower.includes("baked")) prep = "baked";

    const foodId = await insertFoodEntry(
      {
        name,
        category: categorizeUSDA(usdaFood.foodCategory),
        valuePer100g: nutrientData.value,
        confidence: 92,
        preparationMethod: prep,
        evidence: `USDA FoodData Central FDC#${usdaFood.fdcId}: ${usdaFood.description}`,
        sourceUrl: `https://fdc.nal.usda.gov/food-details/${usdaFood.fdcId}/nutrients`,
      },
      nutrientId,
      nutrientUnit,
      sourceId,
      `USDA FoodData Central (FDC#${usdaFood.fdcId})`,
      `https://fdc.nal.usda.gov/food-details/${usdaFood.fdcId}/nutrients`,
    );

    if (foodId) created++;
    else skipped++;
  }

  return { created, skipped, sourceType: "usda_api" };
}

/**
 * Parse web page or raw text content using AI extraction.
 */
async function parseTextSource(
  source: DiscoveredSource,
  nutrientId: string,
  nutrientName: string,
  nutrientUnit: string,
  existingNames: Set<string>,
  trace: ReturnType<ReturnType<typeof getLangfuse>["trace"]>,
): Promise<ParserResult> {
  if (!source.textContent || source.textContent.trim().length < 50) {
    return { created: 0, skipped: 0, sourceType: source.type };
  }

  const model = getModel();
  const modelName = typeof model === "string" ? model : model.modelId;

  const generation = trace.generation({
    name: `parse-${source.type}`,
    model: modelName,
    input: { sourceTitle: source.title, textLength: source.textContent.length },
  });

  const { object, usage } = await generateObject({
    model,
    schema: parseResultSchema,
    prompt: `Extract ALL food entries with ${nutrientName} data from this source.

SOURCE: ${source.title}
${source.url ? `URL: ${source.url}` : ""}

ALREADY IN DATABASE (skip these): ${[...existingNames].slice(0, 100).join(", ")}

CONTENT:
${source.textContent.slice(0, 20000)}

RULES:
- Extract EVERY food with a ${nutrientName} value — do not skip any
- Values must be per 100g. If given per serving, convert using common weights
- Set confidence based on source reliability: government data = 85-95, research = 70-85, other = 50-70
- Include the data source as evidence
- Categorize each food accurately`,
    maxOutputTokens: 16000,
  });

  generation.end({
    output: { entriesFound: object.foods?.length ?? 0 },
    usage: usage
      ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
      : undefined,
  });

  if (usage) {
    await recordAiUsageEvent({
      feature: "parser-agent",
      operation: `parse-${source.type}`,
      model: modelName,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      metadata: {
        sourceType: source.type,
        sourceTitle: source.title,
        entriesFound: object.foods?.length ?? 0,
      },
    });
  }

  if (!object.foods?.length) {
    return { created: 0, skipped: 0, sourceType: source.type };
  }

  const sourceId = await getOrCreateSource(
    source.title,
    source.reliability >= 80 ? "government_db" : "scientific_paper",
    source.reliability,
    source.url,
  );

  let created = 0;
  let skipped = 0;

  for (const entry of object.foods) {
    if (existingNames.has(entry.name.toLowerCase())) {
      skipped++;
      continue;
    }

    const foodId = await insertFoodEntry(
      { ...entry, sourceUrl: source.url },
      nutrientId,
      nutrientUnit,
      sourceId,
      source.title,
      source.url,
    );

    if (foodId) {
      created++;
      existingNames.add(entry.name.toLowerCase());
    } else {
      skipped++;
    }
  }

  return { created, skipped, sourceType: source.type };
}

/**
 * Parser Agent — takes discovered sources and extracts food entries into the DB.
 *
 * Handles:
 * - USDA API results (structured, no AI needed)
 * - Web page text (AI extraction)
 * - Raw text / research notes (AI extraction)
 * - User-uploaded PDFs (via separate pdf-food-parser)
 */
export async function parseDiscoveredSources(
  sources: DiscoveredSource[],
  nutrientId: string,
  userId: string,
): Promise<
  { totalCreated: number; totalSkipped: number; results: ParserResult[] } | { error: string }
> {
  const allNutrients = await db.select().from(nutrients);
  const nutrient = allNutrients.find((n) => n.id === nutrientId);

  if (!nutrient) return { error: "Nutrient not found." };

  const existingFoods = await db.select({ name: foods.name }).from(foods);
  const existingNames = new Set(existingFoods.map((f) => f.name.toLowerCase()));

  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "parser-agent",
    userId,
    metadata: { nutrientId, nutrientName: nutrient.displayName, sourceCount: sources.length },
  });

  const results: ParserResult[] = [];

  for (const source of sources) {
    try {
      let result: ParserResult;

      if (source.type === "usda_api" && source.usdaData) {
        result = await parseUSDASource(source, nutrient.id, nutrient.displayName, nutrient.unit);
      } else if (source.textContent) {
        result = await parseTextSource(
          source,
          nutrient.id,
          nutrient.displayName,
          nutrient.unit,
          existingNames,
          trace,
        );
      } else {
        // Source without parseable content (e.g., PDF URL — user needs to upload manually)
        continue;
      }

      results.push(result);
    } catch (error) {
      console.error(`Failed to parse source "${source.title}":`, error);
      results.push({ created: 0, skipped: 0, sourceType: source.type });
    }
  }

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

  trace.update({
    output: { totalCreated, totalSkipped, sourcesParsed: results.length },
  });
  await flushLangfuse();

  return { totalCreated, totalSkipped, results };
}

function categorizeUSDA(
  usdaCategory?: string,
):
  | "vegetable"
  | "fruit"
  | "protein"
  | "grain"
  | "dairy"
  | "legume"
  | "nut"
  | "oil"
  | "spice"
  | "other" {
  if (!usdaCategory) return "other";
  const cat = usdaCategory.toLowerCase();
  if (cat.includes("vegetable") || cat.includes("greens")) return "vegetable";
  if (cat.includes("fruit")) return "fruit";
  if (
    cat.includes("beef") ||
    cat.includes("pork") ||
    cat.includes("poultry") ||
    cat.includes("fish") ||
    cat.includes("meat") ||
    cat.includes("egg") ||
    cat.includes("seafood")
  )
    return "protein";
  if (cat.includes("grain") || cat.includes("cereal") || cat.includes("bread")) return "grain";
  if (cat.includes("dairy") || cat.includes("milk") || cat.includes("cheese")) return "dairy";
  if (cat.includes("legume") || cat.includes("bean")) return "legume";
  if (cat.includes("nut") || cat.includes("seed")) return "nut";
  if (cat.includes("oil") || cat.includes("fat")) return "oil";
  if (cat.includes("spice") || cat.includes("herb")) return "spice";
  return "other";
}
