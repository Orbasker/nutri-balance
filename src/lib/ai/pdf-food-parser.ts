"use server";

import { generateObject } from "ai";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { foodVariants, foods, servingMeasures } from "@/lib/db/schema/foods";
import {
  evidenceItems,
  sourceRecords,
  sources,
  substanceObservations,
} from "@/lib/db/schema/observations";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";
import { substances } from "@/lib/db/schema/substances";
import { getLangfuse } from "@/lib/langfuse";
import { flushLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";

const PDF_SOURCE_NAME = "User-uploaded PDF";

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

// Lean schema — fewer fields = fewer tokens per entry = more entries fit
const parsedFoodSchema = z.object({
  n: z.string().describe("Food name, short (e.g. 'Spinach', 'Kale')"),
  v: z.number().nonnegative().describe("Value per 100g"),
  p: z.string().describe("Prep: raw/boiled/steamed/fried/roasted/baked/other"),
  c: z
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
    .describe("Category"),
  g: z.number().optional().describe("Grams per household measure if given"),
  m: z.string().optional().describe("Household measure label if given"),
});

const pageParseSchema = z.object({
  substance: z.string().describe("The substance name from the document"),
  unit: z.string().describe("The unit (mcg, mg, g, IU)"),
  foods: z.array(parsedFoodSchema).describe("ALL food entries on this page"),
});

async function getOrCreatePdfSource(fileName: string, url?: string): Promise<string> {
  const sourceName = `${PDF_SOURCE_NAME}: ${fileName}`;
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.name, sourceName))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(sources)
    .values({
      name: sourceName,
      url: url ?? null,
      type: "government_db",
      trustLevel: 85,
    })
    .returning({ id: sources.id });

  return created.id;
}

interface ParsedEntry {
  name: string;
  valuePer100g: number;
  preparationMethod: string;
  category: string;
  measureGrams?: number;
  measure?: string;
  substanceName: string;
  substanceUnit: string;
}

/**
 * Parse a single page of the PDF via AI.
 */
async function parsePdfPage(
  pdfBase64: string,
  pageNumber: number,
  model: ReturnType<typeof getModel>,
  trace: ReturnType<ReturnType<typeof getLangfuse>["trace"]>,
): Promise<ParsedEntry[]> {
  const modelName = typeof model === "string" ? model : model.modelId;

  const generation = trace.generation({
    name: `parse-page-${pageNumber}`,
    model: modelName,
    input: { pageNumber },
  });

  try {
    const { object, usage } = await generateObject({
      model,
      schema: pageParseSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: pdfBase64,
              mediaType: "application/pdf",
            },
            {
              type: "text",
              text: `Extract ONLY the food entries from PAGE ${pageNumber} of this PDF. Return JSON only, no explanation.

Rules:
- Return every food row on page ${pageNumber}
- Use short food names (e.g. "Spinach" not "Spinach, raw, fresh")
- Calculate valuePer100g from the per-measure value if needed
- Conversions: 1 cup leafy ≈ 30-67g, 1 cup cooked veg ≈ 150-180g, 1 tbsp ≈ 14g
- Detect prep method from description (cooked/boiled → boiled, etc). Default: raw
- If this page has no food data rows, return an empty foods array`,
            },
          ],
        },
      ],
      maxOutputTokens: 65000,
    });

    generation.end({
      output: { count: object.foods?.length ?? 0 },
      usage: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
      },
    });

    await recordAiUsageEvent({
      feature: "pdf-food-parser",
      operation: "parse-pdf-page",
      model: modelName,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      metadata: {
        pageNumber,
        parsedCount: object.foods?.length ?? 0,
      },
    });

    return (object.foods ?? []).map((f) => ({
      name: f.n,
      valuePer100g: f.v,
      preparationMethod: f.p,
      category: f.c,
      measureGrams: f.g,
      measure: f.m,
      substanceName: object.substance,
      substanceUnit: object.unit,
    }));
  } catch (error) {
    console.warn(`Failed to parse page ${pageNumber}:`, error);
    generation.end({ output: { error: String(error) } });
    return [];
  }
}

/**
 * Parse a PDF file containing substance data for foods.
 * Processes page by page to handle large documents.
 * Sends PDF natively to AI model (Gemini supports PDF input).
 */
export async function parsePdfToFoods(
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
  sourceUrl?: string,
): Promise<{ count: number; skipped: number } | { error: string }> {
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: "pdf-food-parser",
    userId,
    metadata: { fileName },
  });

  try {
    const model = getModel();
    const pdfBase64 = fileBuffer.toString("base64");

    // Step 1: Get page count + first page data
    const modelName = typeof model === "string" ? model : model.modelId;
    const metaGen = trace.generation({
      name: "get-pdf-meta",
      model: modelName,
      input: { fileName },
    });

    const { object: meta, usage: metaUsage } = await generateObject({
      model,
      schema: z.object({
        totalPages: z.number().describe("Total number of pages in the PDF"),
        title: z.string().describe("Document title"),
        substance: z.string().describe("Primary substance this document covers"),
      }),
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: pdfBase64, mediaType: "application/pdf" },
            {
              type: "text",
              text: "Extract the total page count, document title, and primary substance from this PDF. Return JSON only.",
            },
          ],
        },
      ],
      maxOutputTokens: 2000,
    });

    metaGen.end({
      output: meta,
      usage: metaUsage
        ? {
            input: metaUsage.inputTokens,
            output: metaUsage.outputTokens,
            total: metaUsage.totalTokens,
          }
        : undefined,
    });

    if (metaUsage) {
      await recordAiUsageEvent({
        feature: "pdf-food-parser",
        operation: "get-pdf-meta",
        model: modelName,
        userId,
        usage: {
          inputTokens: metaUsage.inputTokens,
          outputTokens: metaUsage.outputTokens,
          totalTokens: metaUsage.totalTokens,
        },
        metadata: {
          fileName,
          totalPages: meta.totalPages,
        },
      });
    }

    const totalPages = Math.min(meta.totalPages || 1, 20); // Cap at 20 pages

    // Step 2: Parse each page
    const allEntries: ParsedEntry[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const entries = await parsePdfPage(pdfBase64, page, model, trace);
      allEntries.push(...entries);
    }

    if (allEntries.length === 0) {
      return { error: "No food entries could be extracted from this document." };
    }

    // Step 3: Match substances and insert
    const allSubstances = await db.select().from(substances);
    const substanceLookup = new Map<string, (typeof allSubstances)[0]>();
    for (const n of allSubstances) {
      substanceLookup.set(n.displayName.toLowerCase(), n);
      substanceLookup.set(n.name.toLowerCase(), n);
    }

    const findSubstance = (name: string) => {
      const lower = name.toLowerCase();
      return (
        substanceLookup.get(lower) ??
        allSubstances.find(
          (n) =>
            lower.includes(n.displayName.toLowerCase()) || lower.includes(n.name.toLowerCase()),
        )
      );
    };

    const sourceId = await getOrCreatePdfSource(meta.title || fileName, sourceUrl);

    let created = 0;
    let skipped = 0;

    for (const entry of allEntries) {
      const entrySubstance = findSubstance(entry.substanceName);
      if (!entrySubstance) {
        skipped++;
        continue;
      }

      // Check if food already exists
      const existing = await db
        .select({ id: foods.id })
        .from(foods)
        .where(ilike(foods.name, entry.name))
        .limit(1);

      if (existing[0]) {
        skipped++;
        continue;
      }

      // Create food
      const prepMethod: PrepMethod = VALID_PREP_METHODS.includes(
        entry.preparationMethod as PrepMethod,
      )
        ? (entry.preparationMethod as PrepMethod)
        : "raw";

      const [food] = await db
        .insert(foods)
        .values({
          name: entry.name,
          category: (entry.category as (typeof VALID_PREP_METHODS)[number]) || null,
        })
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

      if (entry.measure && entry.measureGrams && entry.measureGrams > 0) {
        await db.insert(servingMeasures).values({
          foodVariantId: fv.id,
          label: entry.measure,
          gramsEquivalent: String(entry.measureGrams),
        });
      }

      const [record] = await db
        .insert(sourceRecords)
        .values({ sourceId, rawData: entry })
        .returning({ id: sourceRecords.id });

      const [observation] = await db
        .insert(substanceObservations)
        .values({
          foodVariantId: fv.id,
          substanceId: entrySubstance.id,
          value: String(entry.valuePer100g),
          unit: entrySubstance.unit,
          basisAmount: "100",
          basisUnit: "g",
          sourceRecordId: record.id,
          derivationType: "analytical",
          confidenceScore: 90,
          reviewStatus: "pending",
        })
        .returning({ id: substanceObservations.id });

      await db.insert(evidenceItems).values({
        observationId: observation.id,
        snippet: `${meta.title}: ${entry.name} — ${entry.valuePer100g} ${entrySubstance.unit}/100g`,
        url: sourceUrl ?? null,
      });

      await db.insert(resolvedSubstanceValues).values({
        foodVariantId: fv.id,
        substanceId: entrySubstance.id,
        valuePer100g: String(entry.valuePer100g),
        confidenceScore: 90,
        confidenceLabel: "High confidence",
        sourceSummary: `USDA: ${meta.title}`,
      });

      created++;
    }

    trace.update({
      output: { created, skipped, totalExtracted: allEntries.length, pages: totalPages },
    });
    await flushLangfuse();

    return { count: created, skipped };
  } catch (error) {
    console.error("PDF parse error:", error);
    trace.update({
      output: { error: error instanceof Error ? error.message : String(error) },
    });
    await flushLangfuse();
    return {
      error: `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
