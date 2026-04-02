import { incrementAiRunUsage } from "@/lib/ai-run-audit";
import { CONFIG_KEYS, getConfigValue } from "@/lib/app-config";
import { sendResendEmailAlert } from "@/lib/ops-alerts";

type JsonRecord = Record<string, unknown>;

interface PricingEntry {
  inputPer1M: number;
  outputPer1M: number;
}

interface UsageMetrics {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface JobRunHandle {
  id: string;
  jobKey: string;
  source: string;
  startedAt: Date;
  aiTaskId?: string | null;
}

interface RunUsageSummary {
  eventCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

const runUsageSummaries = new Map<string, RunUsageSummary>();

export function inferProviderFromModel(model: string): string | null {
  const normalized = model.toLowerCase();

  if (normalized.startsWith("google/") || normalized.startsWith("gemini")) {
    return "google";
  }

  if (
    normalized.startsWith("openai/") ||
    normalized.startsWith("gpt") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3")
  ) {
    return "openai";
  }

  if (normalized.includes("/")) {
    return normalized.split("/")[0] ?? null;
  }

  return null;
}

export function parseAiPricingCatalog(raw: string | undefined): Record<string, PricingEntry> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<PricingEntry>>;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([model, pricing]) => {
        if (
          typeof pricing?.inputPer1M !== "number" ||
          Number.isNaN(pricing.inputPer1M) ||
          typeof pricing?.outputPer1M !== "number" ||
          Number.isNaN(pricing.outputPer1M)
        ) {
          return [];
        }

        return [[model, { inputPer1M: pricing.inputPer1M, outputPer1M: pricing.outputPer1M }]];
      }),
    );
  } catch {
    return {};
  }
}

async function getPricingForModel(model: string): Promise<PricingEntry | null> {
  // Try DB-backed config first, then fall back to env var
  const dbPricing = await getConfigValue<Record<string, Partial<PricingEntry>>>(
    CONFIG_KEYS.AI_MODEL_PRICING,
  );
  const catalog = dbPricing
    ? Object.fromEntries(
        Object.entries(dbPricing).flatMap(([m, p]) =>
          typeof p?.inputPer1M === "number" && typeof p?.outputPer1M === "number"
            ? [[m, { inputPer1M: p.inputPer1M, outputPer1M: p.outputPer1M }]]
            : [],
        ),
      )
    : parseAiPricingCatalog(process.env.AI_MODEL_PRICING_JSON);

  const exactMatch = catalog[model];

  if (exactMatch) {
    return exactMatch;
  }

  const simplifiedModel = model.includes("/") ? model.split("/").at(-1) : model;
  return simplifiedModel ? (catalog[simplifiedModel] ?? null) : null;
}

export async function estimateAiUsageCost(
  model: string,
  usage: UsageMetrics,
): Promise<number | null> {
  const pricing = await getPricingForModel(model);

  if (!pricing) {
    return null;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  const estimated =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;

  return Number(estimated.toFixed(6));
}

async function sendOpsAlert(
  title: string,
  handle: JobRunHandle,
  details: JsonRecord,
): Promise<boolean> {
  return sendResendEmailAlert({
    title,
    headerLines: [
      `job: ${handle.jobKey}`,
      `source: ${handle.source}`,
      ...(handle.aiTaskId ? [`aiTaskId: ${handle.aiTaskId}`] : []),
    ],
    details,
  });
}

function parseBooleanFlag(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
}

function parseNumberFlag(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRunUsageSummary(jobRunId: string | null | undefined): RunUsageSummary | null {
  if (!jobRunId) return null;
  return runUsageSummaries.get(jobRunId) ?? null;
}

export async function startJobRun(input: {
  jobKey: string;
  source: string;
  aiTaskId?: string | null;
  message?: string;
  metadata?: JsonRecord;
}): Promise<JobRunHandle> {
  const id = crypto.randomUUID();
  const startedAt = new Date();

  runUsageSummaries.set(id, {
    eventCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  });

  return {
    id,
    jobKey: input.jobKey,
    source: input.source,
    startedAt,
    aiTaskId: input.aiTaskId,
  };
}

export async function finishJobRun(
  handle: JobRunHandle,
  input: {
    status: "completed" | "failed";
    message?: string;
    errorMessage?: string;
    recordsProcessed?: number;
    errorCount?: number;
    metadata?: JsonRecord;
  },
): Promise<void> {
  const completedAt = new Date();
  const durationMs = Math.max(0, completedAt.getTime() - handle.startedAt.getTime());
  const usageSummary = getRunUsageSummary(handle.id);
  const successNotificationsEnabled =
    (await getConfigValue<boolean>(CONFIG_KEYS.OPS_NOTIFY_ON_SUCCESS)) ??
    parseBooleanFlag(process.env.OPS_NOTIFY_ON_SUCCESS);
  const costThreshold =
    (await getConfigValue<number>(CONFIG_KEYS.AI_JOB_COST_ALERT_THRESHOLD)) ??
    parseNumberFlag(process.env.AI_JOB_COST_ALERT_THRESHOLD_USD);
  const shouldSendCostAlert =
    usageSummary?.estimatedCostUsd != null &&
    costThreshold != null &&
    usageSummary.estimatedCostUsd >= costThreshold;
  const shouldNotify =
    input.status === "failed" ||
    successNotificationsEnabled ||
    shouldSendCostAlert ||
    (input.errorCount ?? 0) > 0;

  if (shouldNotify) {
    const title =
      input.status === "failed"
        ? `[NutriBalance] ${handle.jobKey} failed`
        : `[NutriBalance] ${handle.jobKey} completed`;

    await sendOpsAlert(title, handle, {
      status: input.status,
      durationMs,
      message: input.message ?? null,
      errorMessage: input.errorMessage ?? null,
      recordsProcessed: input.recordsProcessed ?? null,
      errorCount: input.errorCount ?? null,
      totalTokens: usageSummary?.totalTokens ?? null,
      estimatedCostUsd:
        usageSummary?.estimatedCostUsd != null
          ? Number(usageSummary.estimatedCostUsd.toFixed(6))
          : null,
      ...(input.metadata ?? {}),
    });
  }

  runUsageSummaries.delete(handle.id);
}

export async function recordAiUsageEvent(input: {
  feature: string;
  operation: string;
  model: string;
  usage: UsageMetrics;
  aiTaskId?: string | null;
  jobRunId?: string | null;
  aiRunId?: string | null;
  userId?: string | null;
  metadata?: JsonRecord;
}) {
  const inputTokens = input.usage.inputTokens ?? 0;
  const outputTokens = input.usage.outputTokens ?? 0;
  const totalTokens = input.usage.totalTokens ?? inputTokens + outputTokens;
  const estimatedCostUsd = await estimateAiUsageCost(input.model, {
    inputTokens,
    outputTokens,
    totalTokens,
  });
  const runSummary = getRunUsageSummary(input.jobRunId);

  if (runSummary) {
    runSummary.eventCount += 1;
    runSummary.inputTokens += inputTokens;
    runSummary.outputTokens += outputTokens;
    runSummary.totalTokens += totalTokens;

    if (estimatedCostUsd != null) {
      runSummary.estimatedCostUsd = (runSummary.estimatedCostUsd ?? 0) + estimatedCostUsd;
    } else {
      runSummary.estimatedCostUsd = null;
    }
  }

  if (input.aiRunId) {
    await incrementAiRunUsage({
      aiRunId: input.aiRunId,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
    });
  }

  const eventThreshold =
    (await getConfigValue<number>(CONFIG_KEYS.AI_USAGE_ALERT_THRESHOLD)) ??
    parseNumberFlag(process.env.AI_USAGE_ALERT_THRESHOLD_USD);
  const shouldAlertOnEvent =
    estimatedCostUsd != null && eventThreshold != null && estimatedCostUsd >= eventThreshold;

  if (shouldAlertOnEvent) {
    await sendOpsAlert(
      `[NutriBalance] AI usage threshold reached`,
      {
        id: input.jobRunId ?? crypto.randomUUID(),
        jobKey: input.jobRunId ? "ai-job" : "ai-usage-event",
        source: input.jobRunId ? "job" : "direct",
        startedAt: new Date(),
        aiTaskId: input.aiTaskId,
      },
      {
        feature: input.feature,
        operation: input.operation,
        provider: inferProviderFromModel(input.model),
        model: input.model,
        totalTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
        ...(input.metadata ?? {}),
      },
    );
  }
}
