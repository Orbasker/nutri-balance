DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'token_status'
  ) THEN
    CREATE TYPE "token_status" AS ENUM ('pending', 'used', 'expired');
  END IF;
END $$;

ALTER TABLE "account_link_tokens"
  ADD COLUMN IF NOT EXISTS "status" token_status NOT NULL DEFAULT 'pending';

ALTER TABLE "account_link_tokens"
  ADD COLUMN IF NOT EXISTS "used_at" timestamp with time zone;
