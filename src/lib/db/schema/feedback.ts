import { relations } from "drizzle-orm";
import { numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foodVariants, foods } from "./foods";
import { nutrients } from "./nutrients";

export const feedbackTypeEnum = pgEnum("feedback_type", ["flag", "correction"]);

export const feedbackStatusEnum = pgEnum("feedback_status", ["open", "reviewed", "dismissed"]);

export const foodFeedback = pgTable("food_feedback", {
  id: uuid().defaultRandom().primaryKey(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  nutrientId: uuid("nutrient_id").references(() => nutrients.id, {
    onDelete: "cascade",
  }),
  foodVariantId: uuid("food_variant_id").references(() => foodVariants.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id").notNull(),
  type: feedbackTypeEnum().notNull(),
  message: text().notNull(),
  suggestedValue: numeric("suggested_value"),
  suggestedUnit: text("suggested_unit"),
  sourceUrl: text("source_url"),
  status: feedbackStatusEnum().default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

// Relations
export const foodFeedbackRelations = relations(foodFeedback, ({ one }) => ({
  food: one(foods, {
    fields: [foodFeedback.foodId],
    references: [foods.id],
  }),
  nutrient: one(nutrients, {
    fields: [foodFeedback.nutrientId],
    references: [nutrients.id],
  }),
  foodVariant: one(foodVariants, {
    fields: [foodFeedback.foodVariantId],
    references: [foodVariants.id],
  }),
}));
