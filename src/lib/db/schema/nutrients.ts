import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const nutrients = pgTable("nutrients", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull().unique(),
  unit: text().notNull(),
  displayName: text("display_name").notNull(),
  sortOrder: integer("sort_order").default(0),
});
