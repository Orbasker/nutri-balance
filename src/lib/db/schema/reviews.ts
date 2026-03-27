import { relations } from "drizzle-orm";
import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foodVariants } from "./foods";
import { nutrients } from "./nutrients";
import { reviewStatusEnum } from "./observations";

export const reviews = pgTable("reviews", {
  id: uuid().defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  status: reviewStatusEnum().notNull(),
  notes: text(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resolvedNutrientValues = pgTable("resolved_nutrient_values", {
  id: uuid().defaultRandom().primaryKey(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  nutrientId: uuid("nutrient_id")
    .notNull()
    .references(() => nutrients.id, { onDelete: "cascade" }),
  valuePer100g: numeric("value_per_100g").notNull(),
  confidenceScore: integer("confidence_score").default(50),
  confidenceLabel: text("confidence_label"),
  sourceSummary: text("source_summary"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations

export const resolvedNutrientValuesRelations = relations(resolvedNutrientValues, ({ one }) => ({
  foodVariant: one(foodVariants, {
    fields: [resolvedNutrientValues.foodVariantId],
    references: [foodVariants.id],
  }),
  nutrient: one(nutrients, {
    fields: [resolvedNutrientValues.nutrientId],
    references: [nutrients.id],
  }),
}));
