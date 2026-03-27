import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { nutrients } from "./nutrients";

export const aiTaskStatusEnum = pgEnum("ai_task_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const aiTaskTypeEnum = pgEnum("ai_task_type", ["nutrient_research"]);

export const aiTaskCreatorEnum = pgEnum("ai_task_creator", ["user", "scheduler"]);

export const aiTasks = pgTable("ai_tasks", {
  id: uuid().defaultRandom().primaryKey(),
  type: aiTaskTypeEnum().notNull(),
  targetNutrientId: uuid("target_nutrient_id")
    .notNull()
    .references(() => nutrients.id, { onDelete: "cascade" }),
  status: aiTaskStatusEnum().default("pending").notNull(),
  createdBy: aiTaskCreatorEnum("created_by").notNull(),
  userId: text("user_id"),
  progress: jsonb().$type<{ processed: number; total: number; errors: number }>(),
  resultSummary: text("result_summary"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const aiTasksRelations = relations(aiTasks, ({ one }) => ({
  nutrient: one(nutrients, {
    fields: [aiTasks.targetNutrientId],
    references: [nutrients.id],
  }),
}));
