import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appConfig = pgTable("app_config", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  description: text(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
