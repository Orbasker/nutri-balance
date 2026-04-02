import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai-provider";

const HEBREW_CHAR_REGEX = /[\u0590-\u05FF]/;
const SEARCH_ASSIST_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FOOD_TERMS = 6;
const MAX_SUBSTANCE_TERMS = 4;

const aiSearchAssistSchema = z.object({
  foodTerms: z.array(z.string().trim().min(2).max(100)).max(MAX_FOOD_TERMS).default([]),
  substanceTerms: z.array(z.string().trim().min(2).max(100)).max(MAX_SUBSTANCE_TERMS).default([]),
});

export interface AiSearchAssistResult {
  foodTerms: string[];
  substanceTerms: string[];
}

const searchAssistCache = new Map<
  string,
  {
    expiresAt: number;
    result: AiSearchAssistResult;
  }
>();

export function normalizeSearchTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

export function dedupeSearchTerms(terms: string[], originalQuery?: string) {
  const normalizedOriginal = originalQuery
    ? normalizeSearchTerm(originalQuery).toLowerCase()
    : null;
  const seen = new Set<string>();

  return terms
    .map((term) => normalizeSearchTerm(term))
    .filter((term) => term.length >= 2)
    .filter((term) => {
      const lower = term.toLowerCase();
      if (normalizedOriginal && lower === normalizedOriginal) {
        return false;
      }
      if (seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    });
}

export function escapeLikePattern(term: string) {
  return term.replace(/[\\%_]/g, "\\$&");
}

export function getSimilarityThreshold(term: string) {
  const length = normalizeSearchTerm(term).length;

  if (length <= 2) return 0.95;
  if (length <= 4) return 0.6;
  if (length <= 6) return 0.45;
  if (length <= 9) return 0.32;

  return 0.26;
}

export function shouldUseAiSearchAssist(query: string) {
  return HEBREW_CHAR_REGEX.test(query);
}

export async function generateAiSearchAssist(query: string): Promise<AiSearchAssistResult> {
  const normalizedQuery = normalizeSearchTerm(query);

  if (!shouldUseAiSearchAssist(normalizedQuery)) {
    return { foodTerms: [], substanceTerms: [] };
  }

  const cached = searchAssistCache.get(normalizedQuery.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const model = getModel();
    const { object } = await generateObject({
      model,
      schema: aiSearchAssistSchema,
      prompt: `You rewrite food and nutrient search queries so they can match an English nutrition database.

Input query: "${normalizedQuery}"

Return short English lookup terms:
- Use foodTerms for foods, ingredients, or dishes.
- Use substanceTerms for nutrients or food components such as iron, sodium, gluten, or vitamin C.

Rules:
- Translate Hebrew into concise English database terms.
- Fix obvious typos when present.
- Prefer canonical USDA-style food names.
- Keep preparation details only when they are explicit in the query.
- Do not return sentences, explanations, brands, or extra context.
- If the query is clearly a nutrient, leave foodTerms empty.
- If the query is clearly a food, leave substanceTerms empty.`,
    });

    const result = {
      foodTerms: dedupeSearchTerms(object.foodTerms, normalizedQuery).slice(0, MAX_FOOD_TERMS),
      substanceTerms: dedupeSearchTerms(object.substanceTerms, normalizedQuery).slice(
        0,
        MAX_SUBSTANCE_TERMS,
      ),
    };

    searchAssistCache.set(normalizedQuery.toLowerCase(), {
      expiresAt: Date.now() + SEARCH_ASSIST_CACHE_TTL_MS,
      result,
    });

    return result;
  } catch {
    return { foodTerms: [], substanceTerms: [] };
  }
}
