"use server";

import { count, eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { sources, substanceObservations } from "@/lib/db/schema/observations";
import { resolvedSubstanceValues } from "@/lib/db/schema/reviews";

export interface SourceListItem {
  id: string;
  name: string;
  type: string;
  url: string | null;
  trustLevel: number;
  observationCount: number;
}

export interface PipelineStats {
  totalSources: number;
  totalObservations: number;
  totalResolved: number;
  observationsByDerivation: Array<{ derivationType: string; count: number }>;
  observationsByReviewStatus: Array<{ reviewStatus: string; count: number }>;
  sourcesByType: Array<{ type: string; count: number }>;
  avgConfidence: number;
}

export async function getDataSourcesOverview(): Promise<{
  sources: SourceListItem[];
  stats: PipelineStats;
} | null> {
  const admin = await requireAdmin();
  if (!admin) return null;

  // Fetch all sources with observation counts
  const sourceRows = await db
    .select({
      id: sources.id,
      name: sources.name,
      type: sources.type,
      url: sources.url,
      trustLevel: sources.trustLevel,
    })
    .from(sources)
    .orderBy(sources.name);

  // Count observations per source (via source_records join)
  const observationCounts = await db
    .select({
      sourceId: sql<string>`sr.source_id`,
      count: count(),
    })
    .from(substanceObservations)
    .innerJoin(sql`source_records sr`, eq(substanceObservations.sourceRecordId, sql`sr.id`))
    .groupBy(sql`sr.source_id`);

  const countMap = new Map(observationCounts.map((r) => [r.sourceId, Number(r.count)]));

  const sourceList: SourceListItem[] = sourceRows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    url: s.url,
    trustLevel: s.trustLevel ?? 50,
    observationCount: countMap.get(s.id) ?? 0,
  }));

  // Pipeline stats
  const [totalSourcesResult] = await db.select({ count: count() }).from(sources);
  const [totalObsResult] = await db.select({ count: count() }).from(substanceObservations);
  const [totalResolvedResult] = await db.select({ count: count() }).from(resolvedSubstanceValues);

  const obsByDerivation = await db
    .select({
      derivationType: substanceObservations.derivationType,
      count: count(),
    })
    .from(substanceObservations)
    .groupBy(substanceObservations.derivationType);

  const obsByReviewStatus = await db
    .select({
      reviewStatus: substanceObservations.reviewStatus,
      count: count(),
    })
    .from(substanceObservations)
    .groupBy(substanceObservations.reviewStatus);

  const sourcesByType = await db
    .select({
      type: sources.type,
      count: count(),
    })
    .from(sources)
    .groupBy(sources.type);

  const [avgConfResult] = await db
    .select({
      avg: sql<number>`coalesce(avg(${resolvedSubstanceValues.confidenceScore}), 0)`,
    })
    .from(resolvedSubstanceValues);

  return {
    sources: sourceList,
    stats: {
      totalSources: Number(totalSourcesResult?.count ?? 0),
      totalObservations: Number(totalObsResult?.count ?? 0),
      totalResolved: Number(totalResolvedResult?.count ?? 0),
      observationsByDerivation: obsByDerivation.map((r) => ({
        derivationType: r.derivationType,
        count: Number(r.count),
      })),
      observationsByReviewStatus: obsByReviewStatus.map((r) => ({
        reviewStatus: r.reviewStatus,
        count: Number(r.count),
      })),
      sourcesByType: sourcesByType.map((r) => ({
        type: r.type,
        count: Number(r.count),
      })),
      avgConfidence: Math.round(Number(avgConfResult?.avg ?? 0)),
    },
  };
}
