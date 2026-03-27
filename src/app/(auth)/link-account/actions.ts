"use server";

import { and, eq, gt, ne } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { getBot } from "@/lib/bot";
import { db } from "@/lib/db";
import { accountLinkTokens } from "@/lib/db/schema/account-link-tokens";
import { user } from "@/lib/db/schema/auth";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { consumptionLogs, profiles, userNutrientLimits } from "@/lib/db/schema/users";

export type LinkResult =
  | { success: true; platform: string; platformUsername: string | null }
  | { error: string };

/**
 * Validate a link token and return info about the platform account.
 * Does NOT perform the link — just checks if the token is valid.
 */
export async function validateLinkToken(
  token: string,
): Promise<
  | { valid: true; platform: string; platformUsername: string | null }
  | { valid: false; error: string }
> {
  const [row] = await db
    .select({
      platformAccountId: accountLinkTokens.platformAccountId,
      expiresAt: accountLinkTokens.expiresAt,
      platform: platformAccounts.platform,
      platformUsername: platformAccounts.platformUsername,
      currentUserId: platformAccounts.userId,
    })
    .from(accountLinkTokens)
    .innerJoin(platformAccounts, eq(accountLinkTokens.platformAccountId, platformAccounts.id))
    .where(eq(accountLinkTokens.token, token));

  if (!row) {
    return { valid: false, error: "Invalid or expired link token." };
  }

  if (row.expiresAt < new Date()) {
    return { valid: false, error: "This link has expired. Please request a new one from the bot." };
  }

  return {
    valid: true,
    platform: row.platform,
    platformUsername: row.platformUsername,
  };
}

/**
 * Link a bot platform account to the authenticated web user.
 *
 * Steps:
 * 1. Validate the token
 * 2. Get the old bot-only userId from the platform account
 * 3. Reassign platform_accounts.userId → web user
 * 4. Migrate user_nutrient_limits and consumption_logs (skip duplicates)
 * 5. Clean up the old bot-only user + profile if no other platform accounts reference it
 * 6. Delete the used token
 */
export async function linkAccountToWeb(token: string): Promise<LinkResult> {
  // Get the authenticated web user from the session
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to link your account." };
  }
  const webUserId = session.user.id;
  // 1. Validate token and get platform account
  const [tokenRow] = await db
    .select({
      id: accountLinkTokens.id,
      platformAccountId: accountLinkTokens.platformAccountId,
      expiresAt: accountLinkTokens.expiresAt,
    })
    .from(accountLinkTokens)
    .where(and(eq(accountLinkTokens.token, token), gt(accountLinkTokens.expiresAt, new Date())));

  if (!tokenRow) {
    return { error: "Invalid or expired link token." };
  }

  const [platformAccount] = await db
    .select()
    .from(platformAccounts)
    .where(eq(platformAccounts.id, tokenRow.platformAccountId));

  if (!platformAccount) {
    return { error: "Platform account not found." };
  }

  // Already linked to this user?
  if (platformAccount.userId === webUserId) {
    // Clean up token and return success
    await db.delete(accountLinkTokens).where(eq(accountLinkTokens.id, tokenRow.id));
    return {
      success: true,
      platform: platformAccount.platform,
      platformUsername: platformAccount.platformUsername,
    };
  }

  const oldBotUserId = platformAccount.userId;

  // 2. Reassign platform account to web user
  await db
    .update(platformAccounts)
    .set({ userId: webUserId })
    .where(eq(platformAccounts.id, platformAccount.id));

  // 3. Migrate nutrient limits (skip if web user already has limits for the same nutrient)
  const webLimits = await db
    .select({ nutrientId: userNutrientLimits.nutrientId })
    .from(userNutrientLimits)
    .where(eq(userNutrientLimits.userId, webUserId));

  const webNutrientIds = new Set(webLimits.map((l) => l.nutrientId));

  const botLimits = await db
    .select()
    .from(userNutrientLimits)
    .where(eq(userNutrientLimits.userId, oldBotUserId));

  for (const limit of botLimits) {
    if (!webNutrientIds.has(limit.nutrientId)) {
      // Move limit to web user
      await db
        .update(userNutrientLimits)
        .set({ userId: webUserId })
        .where(eq(userNutrientLimits.id, limit.id));
    }
  }

  // 4. Migrate consumption logs — move all to web user
  await db
    .update(consumptionLogs)
    .set({ userId: webUserId })
    .where(eq(consumptionLogs.userId, oldBotUserId));

  // 5. Merge profile data (fill in missing fields from bot profile)
  const [webProfile] = await db.select().from(profiles).where(eq(profiles.id, webUserId));
  const [botProfile] = await db.select().from(profiles).where(eq(profiles.id, oldBotUserId));

  if (webProfile && botProfile) {
    const updates: Record<string, string> = {};
    if (!webProfile.healthGoal && botProfile.healthGoal) updates.healthGoal = botProfile.healthGoal;
    if (!webProfile.clinicalNotes && botProfile.clinicalNotes)
      updates.clinicalNotes = botProfile.clinicalNotes;
    if (
      (!webProfile.displayName || webProfile.displayName === "User") &&
      botProfile.displayName &&
      botProfile.displayName !== "Bot User"
    )
      updates.displayName = botProfile.displayName;

    if (Object.keys(updates).length > 0) {
      await db.update(profiles).set(updates).where(eq(profiles.id, webUserId));
    }
  }

  // 6. Clean up old bot user if no other platform accounts reference it
  const [otherAccounts] = await db
    .select({ id: platformAccounts.id })
    .from(platformAccounts)
    .where(
      and(eq(platformAccounts.userId, oldBotUserId), ne(platformAccounts.id, platformAccount.id)),
    );

  if (!otherAccounts) {
    // No other platform accounts — safe to delete the bot-only user
    // Cascade will handle profile, remaining limits, sessions, etc.
    await db.delete(profiles).where(eq(profiles.id, oldBotUserId));
    await db.delete(user).where(eq(user.id, oldBotUserId));
  }

  // 7. Delete used token (and any other expired tokens for this account)
  await db
    .delete(accountLinkTokens)
    .where(eq(accountLinkTokens.platformAccountId, platformAccount.id));

  // 8. Notify the user on their chat platform that linking succeeded
  notifyPlatformUser(platformAccount.platform, platformAccount.platformUserId, true).catch(() => {
    // Best-effort — don't fail the link if notification fails
  });

  return {
    success: true,
    platform: platformAccount.platform,
    platformUsername: platformAccount.platformUsername,
  };
}

/**
 * Send a notification to the user's chat platform about the link result.
 * Best-effort — failures are silently ignored.
 */
async function notifyPlatformUser(platform: string, platformUserId: string, success: boolean) {
  const bot = getBot();
  const dm = await bot.openDM(`${platform}:${platformUserId}`);
  if (success) {
    await dm.post(
      "Your account has been linked! Your nutrient limits, meal logs, and profile are now synced with your web account. You can continue using the bot as usual.",
    );
  } else {
    await dm.post("Account linking failed. Please try again by asking me for a new link.");
  }
}
