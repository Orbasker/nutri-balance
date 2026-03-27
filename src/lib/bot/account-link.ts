import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { accountLinkTokens } from "@/lib/db/schema/account-link-tokens";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Generate a link token for a bot user and return the URL they should visit.
 * If a valid (non-expired) token already exists, reuse it.
 */
export async function generateLinkUrl(userId: string): Promise<string> {
  // Find the platform account for this user
  const [account] = await db
    .select({ id: platformAccounts.id })
    .from(platformAccounts)
    .where(eq(platformAccounts.userId, userId));

  if (!account) {
    throw new Error("No platform account found for user");
  }

  // Check for existing valid (non-expired, non-used) token
  const [existing] = await db
    .select({ token: accountLinkTokens.token })
    .from(accountLinkTokens)
    .where(
      and(
        eq(accountLinkTokens.platformAccountId, account.id),
        gt(accountLinkTokens.expiresAt, new Date()),
        isNull(accountLinkTokens.usedAt),
      ),
    );

  if (existing) {
    return `${getAppUrl()}/link-account?token=${existing.token}`;
  }

  // Generate new token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(accountLinkTokens).values({
    token,
    platformAccountId: account.id,
    expiresAt,
  });

  console.log("[LinkAccount] Token created:", {
    tokenPrefix: token.slice(0, 8),
    platformAccountId: account.id,
    expiresAt: expiresAt.toISOString(),
  });

  return `${getAppUrl()}/link-account?token=${token}`;
}
