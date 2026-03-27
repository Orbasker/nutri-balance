import { type ModelMessage, generateText } from "ai";

import { getModel } from "@/lib/ai-provider";
import { getLangfuse } from "@/lib/langfuse";
import { recordAiUsageEvent } from "@/lib/ops-monitoring";

/**
 * Create a traced chat completion using the Vercel AI SDK.
 * Provider-agnostic: uses whichever model is configured in ai-provider.ts.
 * Returns the generated text and Langfuse trace for adding scores later.
 */
export async function tracedChatCompletion({
  messages,
  traceName,
  userId,
  metadata,
  temperature,
  maxOutputTokens,
}: {
  messages: ModelMessage[];
  traceName: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  const model = getModel();
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: traceName,
    userId,
    metadata,
  });

  const generation = trace.generation({
    name: "chat-completion",
    model: typeof model === "string" ? model : model.modelId,
    input: messages,
    modelParameters: {
      ...(temperature != null && { temperature }),
      ...(maxOutputTokens != null && { maxOutputTokens }),
    },
  });

  try {
    const result = await generateText({
      model,
      messages,
      temperature,
      maxOutputTokens,
    });

    generation.end({
      output: result.text,
      usage: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
      },
    });

    await recordAiUsageEvent({
      feature: "chat-completion",
      operation: traceName,
      model: typeof model === "string" ? model : model.modelId,
      userId,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
      metadata,
    });

    return { text: result.text, trace };
  } catch (error) {
    generation.end({
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
