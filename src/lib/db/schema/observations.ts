import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { foodVariants } from "./foods";
import { substances } from "./substances";

export const sourceTypeEnum = pgEnum("source_type", [
  "government_db",
  "scientific_paper",
  "industry",
  "user_submission",
  "ai_generated",
]);

export const derivationTypeEnum = pgEnum("derivation_type", [
  "analytical",
  "calculated",
  "estimated",
  "imputed",
  "ai_extracted",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "needs_revision",
]);

export const sources = pgTable("sources", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  url: text(),
  type: sourceTypeEnum().notNull(),
  trustLevel: integer("trust_level").default(50),
});

export const sourceRecords = pgTable("source_records", {
  id: uuid().defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  rawData: jsonb("raw_data"),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
});

export const substanceObservations = pgTable("substance_observations", {
  id: uuid().defaultRandom().primaryKey(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  substanceId: uuid("substance_id")
    .notNull()
    .references(() => substances.id, { onDelete: "cascade" }),
  value: numeric().notNull(),
  unit: text().notNull(),
  basisAmount: numeric("basis_amount").default("100"),
  basisUnit: text("basis_unit").default("g"),
  sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, {
    onDelete: "set null",
  }),
  derivationType: derivationTypeEnum("derivation_type").notNull(),
  confidenceScore: integer("confidence_score").default(50),
  reviewStatus: reviewStatusEnum("review_status").default("pending").notNull(),
});

export const evidenceItems = pgTable("evidence_items", {
  id: uuid().defaultRandom().primaryKey(),
  observationId: uuid("observation_id")
    .notNull()
    .references(() => substanceObservations.id, { onDelete: "cascade" }),
  snippet: text(),
  pageRef: text("page_ref"),
  rowLocator: text("row_locator"),
  url: text(),
});

// Relations

export const sourcesRelations = relations(sources, ({ many }) => ({
  records: many(sourceRecords),
}));

export const sourceRecordsRelations = relations(sourceRecords, ({ one }) => ({
  source: one(sources, {
    fields: [sourceRecords.sourceId],
    references: [sources.id],
  }),
}));

export const substanceObservationsRelations = relations(substanceObservations, ({ one, many }) => ({
  foodVariant: one(foodVariants, {
    fields: [substanceObservations.foodVariantId],
    references: [foodVariants.id],
  }),
  substance: one(substances, {
    fields: [substanceObservations.substanceId],
    references: [substances.id],
  }),
  sourceRecord: one(sourceRecords, {
    fields: [substanceObservations.sourceRecordId],
    references: [sourceRecords.id],
  }),
  evidenceItems: many(evidenceItems),
}));

export const evidenceItemsRelations = relations(evidenceItems, ({ one }) => ({
  observation: one(substanceObservations, {
    fields: [evidenceItems.observationId],
    references: [substanceObservations.id],
  }),
}));
