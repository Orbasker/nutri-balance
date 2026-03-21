import OpenAI from "openai";

import { getLangfuse } from "@/lib/langfuse";

let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return openaiInstance;
}

/**
 * Create a traced OpenAI chat completion with Langfuse observability.
 * Returns both the completion and the trace for adding scores later.
 */
export async function tracedChatCompletion({
  messages,
  model = "gpt-4o-mini",
  traceName,
  userId,
  metadata,
  temperature,
  maxTokens,
}: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  model?: string;
  traceName: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}) {
  const langfuse = getLangfuse();
  const trace = langfuse.trace({
    name: traceName,
    userId,
    metadata,
  });

  const generation = trace.generation({
    name: "chat-completion",
    model,
    input: messages,
    modelParameters: {
      ...(temperature != null && { temperature }),
      ...(maxTokens != null && { maxTokens }),
    },
  });

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    generation.end({
      output: completion.choices[0]?.message,
      usage: {
        input: completion.usage?.prompt_tokens,
        output: completion.usage?.completion_tokens,
        total: completion.usage?.total_tokens,
      },
    });

    return { completion, trace };
  } catch (error) {
    generation.end({
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
