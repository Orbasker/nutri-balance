import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Read-only Drizzle definition for the public.user view.
 *
 * This view maps to auth.users (Supabase Auth). It exists so that
 * FK references from other tables (profiles, consumption_logs, etc.)
 * continue to resolve in Drizzle queries and relations.
 *
 * Do NOT insert/update/delete via Drizzle — use Supabase Auth APIs instead.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
});
