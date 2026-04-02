CREATE TYPE "public"."ai_task_creator" AS ENUM('user', 'scheduler');--> statement-breakpoint
CREATE TYPE "public"."ai_task_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_task_type" AS ENUM('substance_research');--> statement-breakpoint
CREATE TABLE "ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "ai_task_type" NOT NULL,
	"target_substance_id" uuid NOT NULL,
	"status" "ai_task_status" DEFAULT 'pending' NOT NULL,
	"created_by" "ai_task_creator" NOT NULL,
	"user_id" uuid,
	"progress" jsonb,
	"result_summary" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_target_substance_id_substances_id_fk" FOREIGN KEY ("target_substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;