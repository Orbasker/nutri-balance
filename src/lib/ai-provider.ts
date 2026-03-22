import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Provider-agnostic AI model factory.
 *
 * Priority:
 * 1. Vercel AI Gateway (if AI_GATEWAY_API_KEY is set — routes through Vercel dashboard keys)
 * 2. Google Gemini (if GOOGLE_GENERATIVE_AI_API_KEY is set)
 * 3. OpenAI (if OPENAI_API_KEY is set)
 */
export function getModel(modelOverride?: string): LanguageModel {
  if (process.env.VERCEL_AI_KEY) {
    const gateway = createGateway({ apiKey: process.env.VERCEL_AI_KEY });
    return gateway(modelOverride ?? "google/gemini-2.5-flash");
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(modelOverride ?? "gemini-2.5-flash");
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai(modelOverride ?? "gpt-4o-mini");
  }

  throw new Error(
    "No AI provider configured. Set VERCEL_AI_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OPENAI_API_KEY in .env.local",
  );
}
