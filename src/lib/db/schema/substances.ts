import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const substances = pgTable("substances", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  unit: text().notNull(),
  displayName: text("display_name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdBy: text("created_by").references(() => user.id, { onDelete: "cascade" }),
});
