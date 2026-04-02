DO $$ BEGIN
  CREATE TYPE "platform" AS ENUM ('telegram', 'discord');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "onboarding_state" AS ENUM (
    'new',
    'awaiting_name',
    'awaiting_goals',
    'awaiting_substances',
    'awaiting_limits',
    'complete'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "platform_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "platform" "platform" NOT NULL,
  "platform_user_id" text NOT NULL,
  "platform_username" text,
  "onboarding_state" "onboarding_state" DEFAULT 'new' NOT NULL,
  "onboarding_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_accounts_platform_platform_user_id_unique" UNIQUE("platform","platform_user_id")
);
