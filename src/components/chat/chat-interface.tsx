"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createConversation,
  loadConversationMessages,
  saveMessages,
} from "@/app/(app)/chat/actions";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, UIMessagePart } from "ai";
import { DefaultChatTransport, isToolUIPart } from "ai";

import { ChatSidebar } from "@/components/chat/chat-sidebar";

import { cn } from "@/lib/utils";

export function ChatInterface({
  conversationId: initialConversationId,
}: {
  conversationId?: string;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // eslint-disable-next-line react-hooks/refs -- ref is read in body() at send-time, not during render
  const [transport] = useState(() => {
    const ref = conversationIdRef;
    return new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ conversationId: ref.current }),
    });
  });

  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Load existing messages when opening a conversation
  useEffect(() => {
    if (initialConversationId) {
      loadConversationMessages(initialConversationId).then((msgs) => {
        if (msgs.length > 0) {
          setMessages(msgs as UIMessage[]);
        }
      });
    }
  }, [initialConversationId, setMessages]);

  // Persist messages after assistant finishes responding
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isDone = status === "ready";
    prevStatusRef.current = status;

    if (wasStreaming && isDone && conversationIdRef.current && messages.length > 0) {
      saveMessages(
        conversationIdRef.current,
        messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts })),
      );
    }
  }, [status, messages]);

  const scrollTrigger = messages.length + "-" + status;
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollTrigger]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const text = input.trim();
      setInput("");

      // Create a conversation on first message if none exists
      if (!conversationIdRef.current) {
        const id = await createConversation();
        setConversationId(id);
        conversationIdRef.current = id;
        // Update URL to /chat/[id] without full navigation
        window.history.replaceState(null, "", `/chat/${id}`);
      }

      sendMessage({ text });
    },
    [input, isLoading, sendMessage],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const handleQuickSend = useCallback(
    async (text: string) => {
      if (!conversationIdRef.current) {
        const id = await createConversation();
        setConversationId(id);
        conversationIdRef.current = id;
        window.history.replaceState(null, "", `/chat/${id}`);
      }
      sendMessage({ text });
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-md-outline-variant/10">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-xl text-slate-500">menu</span>
        </button>
        <span className="text-sm font-medium text-slate-700 flex-1">NutriBalance Chat</span>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setConversationId(undefined);
            conversationIdRef.current = undefined;
            window.history.replaceState(null, "", "/chat");
          }}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          title="New chat"
        >
          <span className="material-symbols-outlined text-xl text-slate-500">edit_square</span>
        </button>
      </div>

      <ChatSidebar activeId={conversationId} open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {messages.length === 0 && <EmptyState onSend={handleQuickSend} />}

        {messages.map((message) => {
          if (message.role === "user") {
            return <UserBubble key={message.id} message={message} />;
          }
          return <AssistantMessage key={message.id} message={message} isActive={isLoading} />;
        })}

        {status === "submitted" && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Spinner />
              <span className="text-xs text-slate-500">Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 text-red-700 rounded-2xl px-4 py-3 text-sm max-w-sm text-center">
              Something went wrong. Please try again.
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="px-4 pb-2 pt-3 border-t border-md-outline-variant/20"
      >
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a food, check your limits, or log a meal..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-md-outline-variant/30 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all placeholder:text-md-outline"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
              input.trim() && !isLoading
                ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                : "bg-slate-100 text-slate-300",
            )}
          >
            <span className="material-symbols-outlined text-xl">arrow_upward</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Sub-components ─── */

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
        <span className="material-symbols-outlined text-blue-600 text-3xl">nutrition</span>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-md-on-surface">NutriBalance Assistant</h3>
        <p className="text-sm text-md-on-surface-variant max-w-sm">
          Your personal nutrition agent. Ask me about foods, check if you can eat something today,
          or record your meals.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
        {[
          "Can I eat a banana today?",
          "What's my daily summary?",
          "Search for chicken breast",
          "Log 200g of rice for lunch",
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSend(suggestion)}
            className="text-left text-sm px-4 py-3 rounded-2xl border border-md-outline-variant/30 text-md-on-surface-variant hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: UIMessage }) {
  const text = message.parts.find((p) => p.type === "text");
  if (!text || text.type !== "text") return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-3 text-sm leading-relaxed">
        {text.text}
      </div>
    </div>
  );
}

function AssistantMessage({ message, isActive }: { message: UIMessage; isActive: boolean }) {
  const hasText = message.parts.some((p) => p.type === "text" && p.text.trim());
  const toolParts = message.parts.filter(isToolUIPart);

  return (
    <div className="flex justify-start gap-2">
      <div className="max-w-[90%] space-y-2">
        {toolParts.map((part, i) => (
          <ToolCard key={i} part={part} />
        ))}

        {hasText && (
          <div className="rounded-2xl rounded-bl-md bg-slate-100 text-md-on-surface px-4 py-3 text-sm leading-relaxed">
            {message.parts.map((part, i) => {
              if (part.type === "text" && part.text.trim()) {
                return (
                  <div key={i} className="whitespace-pre-wrap">
                    {formatMessage(part.text)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {isActive && !hasText && toolParts.length === 0 && (
          <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 flex items-center gap-2">
            <Spinner />
            <span className="text-xs text-slate-500">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolCard({ part }: { part: UIMessagePart<any, any> }) {
  if (!isToolUIPart(part)) return null;

  const isRunning = part.state === "input-streaming" || part.state === "input-available";
  const isDone = part.state === "output-available";
  const isToolError = part.state === "output-error";

  // Extract real data from input/output
  const input = "input" in part ? (part.input as Record<string, unknown>) : undefined;
  const output = isDone && "output" in part ? (part.output as Record<string, unknown>) : undefined;

  // Detect logical failures (tool ran but returned success: false)
  const isLogicalError = isDone && output?.success === false;
  const isSuccess = isDone && !isLogicalError;
  const isError = isToolError || isLogicalError;

  const { icon, activeText, doneText, errorText } = describeToolAction(part.type, input, output);

  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5 text-xs border transition-all",
        isRunning && "bg-blue-50/80 text-blue-800 border-blue-100",
        isSuccess && "bg-emerald-50/80 text-emerald-800 border-emerald-100",
        isError && "bg-amber-50/80 text-amber-800 border-amber-100",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0">
          {isRunning && <Spinner className="text-blue-500" />}
          {isSuccess && (
            <span
              className="material-symbols-outlined text-sm text-emerald-500"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          )}
          {isError && (
            <span
              className="material-symbols-outlined text-sm text-amber-500"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
          )}
        </span>
        <span className="material-symbols-outlined text-sm opacity-60">{icon}</span>
        <span className="font-medium">
          {isRunning ? activeText : isSuccess ? doneText : errorText}
        </span>
      </div>

      {/* Show summary details when done */}
      {isDone && output && <ToolResultSummary toolType={part.type} output={output} />}
    </div>
  );
}

function ToolResultSummary({
  toolType,
  output,
}: {
  toolType: string;
  output: Record<string, unknown>;
}) {
  if (toolType === "tool-searchFood") {
    const foods = output.foods as Array<{ name: string; variants: unknown[] }> | undefined;
    if (!output.found) return <Detail>No results found in database</Detail>;
    if (!foods?.length) return null;
    return (
      <Detail>
        {foods.map((f) => f.name).join(", ")}
        {foods.length > 3 && ` and ${foods.length - 3} more`}
      </Detail>
    );
  }

  if (toolType === "tool-getFoodNutrients") {
    const nutrients = output.nutrients as
      | Array<{
          displayName: string;
          valuePer100g: number;
          unit: string;
        }>
      | undefined;
    if (!nutrients?.length) return <Detail>No nutrient data available</Detail>;
    const top3 = nutrients.slice(0, 3);
    return (
      <Detail>
        {top3.map((n) => `${n.displayName}: ${n.valuePer100g}${n.unit}/100g`).join(" · ")}
        {nutrients.length > 3 && ` (+${nutrients.length - 3} more)`}
      </Detail>
    );
  }

  if (toolType === "tool-checkCanIEat") {
    const verdict = output.overallVerdict as string;
    const food = output.food as string;
    const grams = output.portionGrams as number;
    const tracked = output.trackedNutrients as
      | Array<{
          nutrient: string;
          percentOfLimit: number | null;
          status: string;
        }>
      | undefined;

    return (
      <div className="mt-1.5 pl-7 space-y-1">
        <div className="flex items-center gap-1.5">
          <VerdictDot verdict={verdict} />
          <span>
            {grams}g of {food} —{" "}
            {verdict === "safe"
              ? "safe to eat"
              : verdict === "caution"
                ? "approaching limit"
                : "would exceed limit"}
          </span>
        </div>
        {tracked && tracked.length > 0 && (
          <div className="text-[11px] opacity-70 space-y-0.5">
            {tracked.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <VerdictDot verdict={t.status} />
                <span>
                  {t.nutrient}: {t.percentOfLimit ?? 0}% of limit
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (toolType === "tool-recordMeal") {
    if (!output.success) return null; // Error shown in card header
    const logged = output.logged as {
      food: string;
      portionGrams: number;
      mealLabel: string | null;
    };
    return (
      <Detail>
        Logged {logged.portionGrams}g of {logged.food}
        {logged.mealLabel && ` (${logged.mealLabel})`}
      </Detail>
    );
  }

  if (toolType === "tool-getDailySummary") {
    const count = output.mealCount as number;
    const tracked = output.trackedNutrients as
      | Array<{
          nutrient: string;
          consumed: number;
          dailyLimit: number | null;
          unit: string;
          percentOfLimit: number | null;
          status: string;
        }>
      | undefined;

    if (!tracked?.length) return <Detail>{count} meals today · no limits configured</Detail>;

    return (
      <div className="mt-1.5 pl-7 space-y-0.5">
        <span className="opacity-70">
          {count} meal{count !== 1 ? "s" : ""} logged today
        </span>
        {tracked.map((t, i) => (
          <div key={i} className="flex items-center gap-1 text-[11px]">
            <VerdictDot verdict={t.status} />
            <span>
              {t.nutrient}: {t.consumed}
              {t.unit}
              {t.dailyLimit ? ` / ${t.dailyLimit}${t.unit} (${t.percentOfLimit}%)` : ""}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (toolType === "tool-aiResearchFood") {
    if (!output.success) return <Detail>{String(output.error ?? "Research failed")}</Detail>;
    return <Detail>{String(output.message)}</Detail>;
  }

  return null;
}

function Detail({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 pl-7 opacity-70">{children}</div>;
}

function VerdictDot({ verdict }: { verdict: string }) {
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
        verdict === "safe" && "bg-emerald-500",
        verdict === "caution" && "bg-amber-500",
        verdict === "exceed" && "bg-red-500",
      )}
    />
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("animate-spin inline-flex", className)}>
      <span className="material-symbols-outlined text-sm">progress_activity</span>
    </span>
  );
}

/* ─── Helpers ─── */

type ToolDescription = { icon: string; activeText: string; doneText: string; errorText: string };

function describeToolAction(
  partType: string,
  input?: Record<string, unknown>,
  output?: Record<string, unknown>,
): ToolDescription {
  const errMsg = output?.error as string | undefined;

  switch (partType) {
    case "tool-searchFood": {
      const query = (input?.query as string) ?? "food";
      const count = (output?.foods as unknown[])?.length;
      return {
        icon: "search",
        activeText: `Searching for "${query}"...`,
        doneText: count
          ? `Found ${count} result${count > 1 ? "s" : ""} for "${query}"`
          : `No results for "${query}"`,
        errorText: `Search failed for "${query}"`,
      };
    }
    case "tool-getFoodNutrients": {
      const count = (output?.nutrients as unknown[])?.length;
      return {
        icon: "labs",
        activeText: "Loading nutrient breakdown...",
        doneText: count ? `Loaded ${count} nutrient values` : "No nutrient data found",
        errorText: "Failed to load nutrients",
      };
    }
    case "tool-checkCanIEat": {
      const food = (output?.food as string) ?? "food";
      const grams = input?.portionGrams as number;
      const verdict = output?.overallVerdict as string;
      return {
        icon: "vital_signs",
        activeText: grams ? `Checking ${grams}g against your limits...` : "Checking limits...",
        doneText: verdict
          ? `${food}: ${verdict === "safe" ? "Safe to eat" : verdict === "caution" ? "Approaching limit" : "Would exceed limit"}`
          : "Limit check complete",
        errorText: "Could not check limits",
      };
    }
    case "tool-recordMeal": {
      const grams = input?.portionGrams as number;
      const meal = input?.mealLabel as string | undefined;
      const foodName = (output?.logged as Record<string, unknown>)?.food as string | undefined;
      return {
        icon: "restaurant",
        activeText: grams
          ? `Recording ${grams}g${meal ? ` for ${meal}` : ""}...`
          : "Recording meal...",
        doneText: foodName ? `Logged ${grams}g of ${foodName}` : "Meal recorded",
        errorText: errMsg ? `Failed to record: ${errMsg}` : "Failed to record meal",
      };
    }
    case "tool-getDailySummary": {
      const count = output?.mealCount as number | undefined;
      return {
        icon: "monitoring",
        activeText: "Loading your daily intake...",
        doneText:
          count !== undefined
            ? `Today: ${count} meal${count !== 1 ? "s" : ""} logged`
            : "Summary loaded",
        errorText: "Failed to load summary",
      };
    }
    case "tool-aiResearchFood": {
      const name = (input?.foodName as string) ?? "food";
      return {
        icon: "science",
        activeText: `Researching "${name}" — this may take a moment...`,
        doneText: `"${name}" added to database`,
        errorText: errMsg ? `Research failed: ${errMsg}` : `Could not research "${name}"`,
      };
    }
    default:
      return { icon: "pending", activeText: "Working...", doneText: "Done", errorText: "Failed" };
  }
}

function formatMessage(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
