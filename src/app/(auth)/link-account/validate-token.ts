import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accountLinkTokens } from "@/lib/db/schema/account-link-tokens";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";

/**
 * Validate a link token and return info about the platform account.
 * This is a plain server-side query (NOT a server action) — safe to call from server components.
 */
export async function validateLinkToken(
  token: string,
): Promise<
  | { valid: true; platform: string; platformUsername: string | null }
  | { valid: false; error: string }
> {
  // First, find the token itself (without join)
  const [tokenRow] = await db
    .select({
      platformAccountId: accountLinkTokens.platformAccountId,
      expiresAt: accountLinkTokens.expiresAt,
    })
    .from(accountLinkTokens)
    .where(eq(accountLinkTokens.token, token));

  if (!tokenRow) {
    return { valid: false, error: "Invalid or expired link token." };
  }

  if (tokenRow.expiresAt < new Date()) {
    return { valid: false, error: "This link has expired. Please request a new one from the bot." };
  }

  // Then look up the platform account
  const [account] = await db
    .select({
      platform: platformAccounts.platform,
      platformUsername: platformAccounts.platformUsername,
    })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, tokenRow.platformAccountId));

  if (!account) {
    return { valid: false, error: "Platform account not found. Please request a new link." };
  }

  return {
    valid: true,
    platform: account.platform,
    platformUsername: account.platformUsername,
  };
}
