import { relations } from "drizzle-orm";
import { numeric, pgTable, uuid } from "drizzle-orm/pg-core";

import { foodVariants, foods, preparationMethodEnum } from "./foods";
import { sources } from "./observations";
import { substances } from "./substances";

export const retentionProfiles = pgTable("retention_profiles", {
  id: uuid().defaultRandom().primaryKey(),
  substanceId: uuid("substance_id")
    .notNull()
    .references(() => substances.id, { onDelete: "cascade" }),
  preparationMethod: preparationMethodEnum("preparation_method").notNull(),
  retentionFactor: numeric("retention_factor").notNull(),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
});

export const yieldProfiles = pgTable("yield_profiles", {
  id: uuid().defaultRandom().primaryKey(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  preparationMethod: preparationMethodEnum("preparation_method").notNull(),
  yieldFactor: numeric("yield_factor").notNull(),
});

export const variantCalculationRules = pgTable("variant_calculation_rules", {
  id: uuid().defaultRandom().primaryKey(),
  foodVariantId: uuid("food_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  baseVariantId: uuid("base_variant_id")
    .notNull()
    .references(() => foodVariants.id, { onDelete: "cascade" }),
  retentionProfileId: uuid("retention_profile_id").references(() => retentionProfiles.id, {
    onDelete: "set null",
  }),
  yieldProfileId: uuid("yield_profile_id").references(() => yieldProfiles.id, {
    onDelete: "set null",
  }),
});

// Relations

export const retentionProfilesRelations = relations(retentionProfiles, ({ one }) => ({
  substance: one(substances, {
    fields: [retentionProfiles.substanceId],
    references: [substances.id],
  }),
  source: one(sources, {
    fields: [retentionProfiles.sourceId],
    references: [sources.id],
  }),
}));

export const yieldProfilesRelations = relations(yieldProfiles, ({ one }) => ({
  food: one(foods, {
    fields: [yieldProfiles.foodId],
    references: [foods.id],
  }),
}));

export const variantCalculationRulesRelations = relations(variantCalculationRules, ({ one }) => ({
  foodVariant: one(foodVariants, {
    fields: [variantCalculationRules.foodVariantId],
    references: [foodVariants.id],
    relationName: "calculatedVariant",
  }),
  baseVariant: one(foodVariants, {
    fields: [variantCalculationRules.baseVariantId],
    references: [foodVariants.id],
    relationName: "baseVariant",
  }),
  retentionProfile: one(retentionProfiles, {
    fields: [variantCalculationRules.retentionProfileId],
    references: [retentionProfiles.id],
  }),
  yieldProfile: one(yieldProfiles, {
    fields: [variantCalculationRules.yieldProfileId],
    references: [yieldProfiles.id],
  }),
}));
