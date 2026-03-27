-- Change platform_accounts.user_id from uuid to text
-- to match the user.id column type (Better Auth generates nanoid text IDs, not UUIDs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_accounts'
      AND column_name = 'user_id'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE "platform_accounts"
      ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
  END IF;
END $$;
