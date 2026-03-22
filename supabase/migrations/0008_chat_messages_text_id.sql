-- Change chat_messages.id from uuid to text to match AI SDK's short alphanumeric IDs
ALTER TABLE "chat_messages" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "chat_messages" ALTER COLUMN "id" SET DATA TYPE text;
