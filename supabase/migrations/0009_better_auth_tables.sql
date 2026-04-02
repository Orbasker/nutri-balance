-- Create Better Auth tables (IF NOT EXISTS for idempotency against remote DB state drift)
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_name" text,
	"last_name" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Drop RLS policies that reference columns being altered (Better Auth uses app-layer auth, not RLS)
DROP POLICY IF EXISTS "Users can manage own conversations" ON "chat_conversations";--> statement-breakpoint
DROP POLICY IF EXISTS "Users can manage messages in own conversations" ON "chat_messages";--> statement-breakpoint
ALTER TABLE "chat_conversations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users can insert own feedback" ON "food_feedback";--> statement-breakpoint
DROP POLICY IF EXISTS "Users read own feedback, admins read all" ON "food_feedback";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can update feedback" ON "food_feedback";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can delete feedback" ON "food_feedback";--> statement-breakpoint
ALTER TABLE "food_feedback" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "consumption_logs_select" ON "consumption_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "consumption_logs_insert" ON "consumption_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "consumption_logs_update" ON "consumption_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "consumption_logs_delete" ON "consumption_logs";--> statement-breakpoint
ALTER TABLE "consumption_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "user_substance_limits_select" ON "user_substance_limits";--> statement-breakpoint
DROP POLICY IF EXISTS "user_substance_limits_insert" ON "user_substance_limits";--> statement-breakpoint
DROP POLICY IF EXISTS "user_substance_limits_update" ON "user_substance_limits";--> statement-breakpoint
DROP POLICY IF EXISTS "user_substance_limits_delete" ON "user_substance_limits";--> statement-breakpoint
ALTER TABLE "user_substance_limits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "profiles_select" ON "profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "profiles_insert" ON "profiles";--> statement-breakpoint
DROP POLICY IF EXISTS "profiles_update" ON "profiles";--> statement-breakpoint
ALTER TABLE "profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Convert uuid columns to text for Better Auth compatibility (user_id references only)
ALTER TABLE "ai_tasks" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "food_feedback" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "foods" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "reviewer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "consumption_logs" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_substance_limits" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
-- Add FK constraints to new user table (idempotent: skip if constraint already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_user_id_fk') THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_user_id_fk') THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
-- Clean up orphaned rows from old Supabase auth before adding FK constraints to Better Auth user table
DELETE FROM "chat_messages" WHERE "conversation_id" IN (
  SELECT "id" FROM "chat_conversations" WHERE "user_id" NOT IN (SELECT "id" FROM "user")
);--> statement-breakpoint
DELETE FROM "chat_conversations" WHERE "user_id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DELETE FROM "consumption_logs" WHERE "user_id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DELETE FROM "profiles" WHERE "id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DELETE FROM "user_substance_limits" WHERE "user_id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DELETE FROM "food_feedback" WHERE "user_id" NOT IN (SELECT "id" FROM "user");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_user_id_user_id_fk') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_logs_user_id_user_id_fk') THEN
    ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_user_id_fk') THEN
    ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_substance_limits_user_id_user_id_fk') THEN
    ALTER TABLE "user_substance_limits" ADD CONSTRAINT "user_substance_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_feedback_user_id_user_id_fk') THEN
    ALTER TABLE "food_feedback" ADD CONSTRAINT "food_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;