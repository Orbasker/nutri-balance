import { relations } from "drizzle-orm";
import { jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foodVariants, servingMeasures } from "./foods";
import { nutrients } from "./nutrients";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const limitModeEnum = pgEnum("limit_mode", ["strict", "stability"]);

export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  displayName: text("display_name"),
  role: userRoleEnum().default("user").notNull(),
  clinicalNotes: text("clinical_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userNutrientLimits = pgTable("user_nutrient_limits", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  nutrientId: uuid("nutrient_id")
    .notNull()
    .references(() => nutrients.id, { onDelete: "cascade" }),
  dailyLimit: numeric("daily_limit").notNull(),
  mode: limitModeEnum().default("strict").notNull(),
  rangeMin: numeric("range_min"),
  rangeMax: numeric("range_max"),
});

export const consumptionLogs = pgTable("consumption_logs", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  servingMeasureId: uuid("serving_measure_id").references(() => servingMeasures.id, {
    onDelete: "set null",
  }),
  quantity: numeric().notNull(),
  nutrientSnapshot: jsonb("nutrient_snapshot"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
  mealLabel: text("meal_label"),
});

// Relations

export const profilesRelations = relations(profiles, ({ many }) => ({
  nutrientLimits: many(userNutrientLimits),
  consumptionLogs: many(consumptionLogs),
}));

export const userNutrientLimitsRelations = relations(userNutrientLimits, ({ one }) => ({
  profile: one(profiles, {
    fields: [userNutrientLimits.userId],
    references: [profiles.id],
  }),
  nutrient: one(nutrients, {
    fields: [userNutrientLimits.nutrientId],
    references: [nutrients.id],
  }),
}));

export const consumptionLogsRelations = relations(consumptionLogs, ({ one }) => ({
  profile: one(profiles, {
    fields: [consumptionLogs.userId],
    references: [profiles.id],
  }),
  foodVariant: one(foodVariants, {
    fields: [consumptionLogs.foodVariantId],
    references: [foodVariants.id],
  }),
  servingMeasure: one(servingMeasures, {
    fields: [consumptionLogs.servingMeasureId],
    references: [servingMeasures.id],
  }),
}));
