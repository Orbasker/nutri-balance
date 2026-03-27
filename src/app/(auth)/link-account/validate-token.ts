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
  | { valid: true; platform: string; platformUsername: string | null; alreadyUsed?: boolean }
  | { valid: false; error: string }
> {
  // First, find the token itself (without join)
  let tokenRow = await findToken(token);

  // Retry once after a short delay — handles DB replication lag
  if (!tokenRow) {
    await new Promise((r) => setTimeout(r, 1000));
    tokenRow = await findToken(token);
  }

  if (!tokenRow) {
    console.error("[LinkAccount] Token not found in DB:", {
      tokenPrefix: token.slice(0, 8),
      tokenLength: token.length,
    });
    return { valid: false, error: "Invalid or expired link token." };
  }

  // Token was already used — treat as valid so the page can show "already linked"
  // instead of "expired" (the RSC re-renders after the server action)
  if (tokenRow.usedAt) {
    const [account] = await db
      .select({
        platform: platformAccounts.platform,
        platformUsername: platformAccounts.platformUsername,
      })
      .from(platformAccounts)
      .where(eq(platformAccounts.id, tokenRow.platformAccountId));

    return {
      valid: true,
      platform: account?.platform ?? "unknown",
      platformUsername: account?.platformUsername ?? null,
      alreadyUsed: true,
    };
  }

  const now = new Date();
  if (new Date(tokenRow.expiresAt).getTime() < now.getTime()) {
    console.error("[LinkAccount] Token expired:", {
      tokenPrefix: token.slice(0, 8),
      expiresAt: tokenRow.expiresAt,
      now: now.toISOString(),
    });
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
    console.error("[LinkAccount] Platform account not found for token:", {
      platformAccountId: tokenRow.platformAccountId,
    });
    return { valid: false, error: "Platform account not found. Please request a new link." };
  }

  return {
    valid: true,
    platform: account.platform,
    platformUsername: account.platformUsername,
  };
}

async function findToken(token: string) {
  const [row] = await db
    .select({
      platformAccountId: accountLinkTokens.platformAccountId,
      expiresAt: accountLinkTokens.expiresAt,
      usedAt: accountLinkTokens.usedAt,
    })
    .from(accountLinkTokens)
    .where(eq(accountLinkTokens.token, token));
  return row ?? null;
}
