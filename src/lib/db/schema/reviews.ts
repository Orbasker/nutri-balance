import { relations } from "drizzle-orm";
import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foodVariants } from "./foods";
import { reviewStatusEnum } from "./observations";
import { substances } from "./substances";

export const reviews = pgTable("reviews", {
  id: uuid().defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  status: reviewStatusEnum().notNull(),
  notes: text(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resolvedSubstanceValues = pgTable("resolved_substance_values", {
  id: uuid().defaultRandom().primaryKey(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  substanceId: uuid("substance_id")
    .notNull()
    .references(() => substances.id, { onDelete: "cascade" }),
  valuePer100g: numeric("value_per_100g").notNull(),
  confidenceScore: integer("confidence_score").default(50),
  confidenceLabel: text("confidence_label"),
  sourceSummary: text("source_summary"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations

export const resolvedSubstanceValuesRelations = relations(resolvedSubstanceValues, ({ one }) => ({
  foodVariant: one(foodVariants, {
    fields: [resolvedSubstanceValues.foodVariantId],
    references: [foodVariants.id],
  }),
  substance: one(substances, {
    fields: [resolvedSubstanceValues.substanceId],
    references: [substances.id],
  }),
}));
