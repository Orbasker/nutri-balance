"use server";

import type { AiObservationItem, AiObservationStatusCounts, EvidenceItem } from "@/types";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import {
  evidenceItems,
  nutrientObservations,
  sourceRecords,
  sources,
} from "@/lib/db/schema/observations";

export type AiObservationStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_revision";

const emptyCounts: AiObservationStatusCounts = {
  all: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  needsRevision: 0,
};

export async function getAiObservationCounts(): Promise<AiObservationStatusCounts> {
  const adminId = await requireAdmin();
  if (!adminId) return emptyCounts;

  const rows = await db
    .select({
      reviewStatus: nutrientObservations.reviewStatus,
      count: sql<number>`count(*)`,
    })
    .from(nutrientObservations)
    .where(eq(nutrientObservations.derivationType, "ai_extracted"))
    .groupBy(nutrientObservations.reviewStatus);

  return rows.reduce<AiObservationStatusCounts>(
    (acc, row) => {
      const count = Number(row.count);
      acc.all += count;

      if (row.reviewStatus === "pending") acc.pending = count;
      if (row.reviewStatus === "approved") acc.approved = count;
      if (row.reviewStatus === "rejected") acc.rejected = count;
      if (row.reviewStatus === "needs_revision") acc.needsRevision = count;

      return acc;
    },
    { ...emptyCounts },
  );
}

export async function getAiObservations(input?: {
  status?: AiObservationStatusFilter;
  query?: string;
}): Promise<AiObservationItem[]> {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  const status = input?.status ?? "all";
  const query = input?.query?.trim();
  const conditions = [eq(nutrientObservations.derivationType, "ai_extracted")];

  if (status !== "all") {
    conditions.push(eq(nutrientObservations.reviewStatus, status));
  }

  if (query) {
    const search = `%${query}%`;
    conditions.push(
      or(
        ilike(foods.name, search),
        ilike(nutrients.displayName, search),
        ilike(foodVariants.preparationMethod, search),
      )!,
    );
  }

  const rows = await db
    .select({
      id: nutrientObservations.id,
      foodVariantId: nutrientObservations.foodVariantId,
      foodName: foods.name,
      preparationMethod: foodVariants.preparationMethod,
      nutrientName: nutrients.name,
      nutrientDisplayName: nutrients.displayName,
      value: nutrientObservations.value,
      unit: nutrientObservations.unit,
      derivationType: nutrientObservations.derivationType,
      confidenceScore: nutrientObservations.confidenceScore,
      reviewStatus: nutrientObservations.reviewStatus,
      sourceName: sources.name,
      sourceType: sources.type,
      importedAt: sourceRecords.importedAt,
    })
    .from(nutrientObservations)
    .innerJoin(foodVariants, eq(foodVariants.id, nutrientObservations.foodVariantId))
    .innerJoin(foods, eq(foods.id, foodVariants.foodId))
    .innerJoin(nutrients, eq(nutrients.id, nutrientObservations.nutrientId))
    .leftJoin(sourceRecords, eq(sourceRecords.id, nutrientObservations.sourceRecordId))
    .leftJoin(sources, eq(sources.id, sourceRecords.sourceId))
    .where(and(...conditions))
    .orderBy(sql`${sourceRecords.importedAt} DESC NULLS LAST`, foods.name, nutrients.sortOrder);

  if (rows.length === 0) return [];

  const observationIds = rows.map((row) => row.id);
  const evidence = await db
    .select({
      id: evidenceItems.id,
      observationId: evidenceItems.observationId,
      snippet: evidenceItems.snippet,
      pageRef: evidenceItems.pageRef,
      rowLocator: evidenceItems.rowLocator,
      url: evidenceItems.url,
    })
    .from(evidenceItems)
    .where(inArray(evidenceItems.observationId, observationIds));

  const evidenceMap = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const list = evidenceMap.get(item.observationId) ?? [];
    list.push({
      id: item.id,
      snippet: item.snippet,
      pageRef: item.pageRef,
      rowLocator: item.rowLocator,
      url: item.url,
    });
    evidenceMap.set(item.observationId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    foodVariantId: row.foodVariantId,
    foodName: row.foodName,
    preparationMethod: row.preparationMethod,
    nutrientName: row.nutrientName,
    nutrientDisplayName: row.nutrientDisplayName,
    value: Number(row.value),
    unit: row.unit,
    derivationType: row.derivationType,
    confidenceScore: row.confidenceScore ?? 50,
    reviewStatus: row.reviewStatus,
    evidenceItems: evidenceMap.get(row.id) ?? [],
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    importedAt: row.importedAt?.toISOString() ?? null,
  }));
}
