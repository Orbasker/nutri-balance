import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { platformAccounts } from "./platform-accounts";

export const tokenStatusEnum = pgEnum("token_status", ["pending", "used", "expired"]);

/**
 * Short-lived tokens used to link a bot platform account to an existing web user.
 *
 * Flow:
 * 1. Bot user sends /link → token generated here (status: pending)
 * 2. User clicks URL with token → signs in on web
 * 3. Web app validates token, reassigns platform_accounts.userId to web user (status: used)
 * 4. Tokens past expiresAt are considered expired
 */
export const accountLinkTokens = pgTable("account_link_tokens", {
  id: uuid().defaultRandom().primaryKey(),
  token: text().notNull().unique(),
  platformAccountId: uuid("platform_account_id")
    .notNull()
    .references(() => platformAccounts.id, { onDelete: "cascade" }),
  status: tokenStatusEnum().notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
