import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { profiles } from "./users";

export const platformEnum = pgEnum("platform", ["telegram", "discord"]);

export const onboardingStateEnum = pgEnum("onboarding_state", [
  "new",
  "awaiting_name",
  "awaiting_goals",
  "awaiting_nutrients",
  "awaiting_limits",
  "complete",
]);

export const platformAccounts = pgTable(
  "platform_accounts",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    platform: platformEnum().notNull(),
    platformUserId: text("platform_user_id").notNull(),
    platformUsername: text("platform_username"),
    onboardingState: onboardingStateEnum("onboarding_state").default("new").notNull(),
    onboardingData: jsonb("onboarding_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.platform, t.platformUserId)],
);

export const platformAccountRelations = relations(platformAccounts, ({ one }) => ({
  profile: one(profiles, {
    fields: [platformAccounts.userId],
    references: [profiles.id],
  }),
}));
