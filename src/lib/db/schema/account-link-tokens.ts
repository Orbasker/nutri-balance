import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { platformAccounts } from "./platform-accounts";

/**
 * Short-lived tokens used to link a bot platform account to an existing web user.
 *
 * Flow:
 * 1. Bot user sends /link → token generated here
 * 2. User clicks URL with token → signs in on web
 * 3. Web app validates token, reassigns platform_accounts.userId to web user
 */
export const accountLinkTokens = pgTable("account_link_tokens", {
  id: uuid().defaultRandom().primaryKey(),
  token: text().notNull().unique(),
  platformAccountId: uuid("platform_account_id")
    .notNull()
    .references(() => platformAccounts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
