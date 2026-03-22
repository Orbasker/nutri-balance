import { relations } from "drizzle-orm";
import { boolean, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foodFeedback } from "./feedback";

export const preparationMethodEnum = pgEnum("preparation_method", [
  "raw",
  "boiled",
  "steamed",
  "grilled",
  "baked",
  "fried",
  "roasted",
  "sauteed",
  "poached",
  "blanched",
  "drained",
]);

export const foods = pgTable("foods", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  category: text(),
  description: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
});

export const foodAliases = pgTable("food_aliases", {
  id: uuid().defaultRandom().primaryKey(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  alias: text().notNull(),
  language: text().default("en"),
  source: text(),
});

export const foodVariants = pgTable("food_variants", {
  id: uuid().defaultRandom().primaryKey(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  preparationMethod: preparationMethodEnum("preparation_method").notNull(),
  description: text(),
  isDefault: boolean("is_default").default(false),
});

export const servingMeasures = pgTable("serving_measures", {
  id: uuid().defaultRandom().primaryKey(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  label: text().notNull(),
  gramsEquivalent: numeric("grams_equivalent").notNull(),
});

// Relations

export const foodsRelations = relations(foods, ({ many }) => ({
  aliases: many(foodAliases),
  variants: many(foodVariants),
  feedback: many(foodFeedback),
}));

export const foodAliasesRelations = relations(foodAliases, ({ one }) => ({
  food: one(foods, {
    fields: [foodAliases.foodId],
    references: [foods.id],
  }),
}));

export const foodVariantsRelations = relations(foodVariants, ({ one, many }) => ({
  food: one(foods, {
    fields: [foodVariants.foodId],
    references: [foods.id],
  }),
  servingMeasures: many(servingMeasures),
}));

export const servingMeasuresRelations = relations(servingMeasures, ({ one }) => ({
  foodVariant: one(foodVariants, {
    fields: [servingMeasures.foodVariantId],
    references: [foodVariants.id],
  }),
}));
