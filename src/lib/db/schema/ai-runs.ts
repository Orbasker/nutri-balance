import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { aiTasks } from "./ai-tasks";
import { user } from "./auth";
import { foods } from "./foods";

export const aiRunTypeEnum = pgEnum("ai_run_type", [
  "food_generation",
  "substance_research_task",
  "ai_review",
]);

export const aiRunStatusEnum = pgEnum("ai_run_status", ["running", "completed", "failed"]);

export const aiRuns = pgTable("ai_runs", {
  id: uuid().defaultRandom().primaryKey(),
  type: aiRunTypeEnum().notNull(),
  status: aiRunStatusEnum().default("running").notNull(),
  goal: text().notNull(),
  source: text().notNull(),
  triggerUserId: text("trigger_user_id").references(() => user.id, { onDelete: "set null" }),
  aiTaskId: uuid("ai_task_id").references(() => aiTasks.id, { onDelete: "set null" }),
  foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
  itemCount: integer("item_count"),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
  resultSummary: text("result_summary"),
  errorMessage: text("error_message"),
  metadata: jsonb(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
});

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  triggerUser: one(user, {
    fields: [aiRuns.triggerUserId],
    references: [user.id],
  }),
  aiTask: one(aiTasks, {
    fields: [aiRuns.aiTaskId],
    references: [aiTasks.id],
  }),
  food: one(foods, {
    fields: [aiRuns.foodId],
    references: [foods.id],
  }),
}));
