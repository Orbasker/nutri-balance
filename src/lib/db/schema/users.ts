import { relations } from "drizzle-orm";
import { date, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { foodVariants, servingMeasures } from "./foods";
import { substances } from "./substances";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const limitModeEnum = pgEnum("limit_mode", ["strict", "stability"]);

export const profiles = pgTable("profiles", {
  id: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  role: userRoleEnum().default("user").notNull(),
  clinicalNotes: text("clinical_notes"),
  healthGoal: text("health_goal"),
  avatarColor: text("avatar_color").default("blue"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSubstanceLimits = pgTable("user_substance_limits", {
  id: uuid().defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  substanceId: uuid("substance_id")
    .notNull()
    .references(() => substances.id, { onDelete: "cascade" }),
  dailyLimit: numeric("daily_limit").notNull(),
  mode: limitModeEnum().default("strict").notNull(),
  rangeMin: numeric("range_min"),
  rangeMax: numeric("range_max"),
});

export const consumptionLogs = pgTable("consumption_logs", {
  id: uuid().defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  servingMeasureId: uuid("serving_measure_id").references(() => servingMeasures.id, {
    onDelete: "set null",
  }),
  quantity: numeric().notNull(),
  substanceSnapshot: jsonb("substance_snapshot"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
  mealLabel: text("meal_label"),
});

// Relations

export const profilesRelations = relations(profiles, ({ many }) => ({
  substanceLimits: many(userSubstanceLimits),
  consumptionLogs: many(consumptionLogs),
}));

export const userSubstanceLimitsRelations = relations(userSubstanceLimits, ({ one }) => ({
  profile: one(profiles, {
    fields: [userSubstanceLimits.userId],
    references: [profiles.id],
  }),
  substance: one(substances, {
    fields: [userSubstanceLimits.substanceId],
    references: [substances.id],
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
