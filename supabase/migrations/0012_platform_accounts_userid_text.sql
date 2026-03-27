-- Change platform_accounts.user_id from uuid to text
-- to match the user.id column type (Better Auth generates nanoid text IDs, not UUIDs)
ALTER TABLE "platform_accounts" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
