"use server";

import { and, eq, ne } from "drizzle-orm";

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

type LinkTokenContext = {
  tokenId: string;
  platformAccountId: string;
  expiresAt: Date;
  usedAt: Date | null;
  linkedUserId: string;
  platform: string;
  platformUserId: string;
  platformUsername: string | null;
};

/**
 * Link a bot platform account to the authenticated web user.
 *
 * Steps:
 * 1. Validate the token
 * 2. Get the old bot-only userId from the platform account
 * 3. Reassign platform_accounts.userId → web user
 * 4. Migrate user_nutrient_limits and consumption_logs (skip duplicates)
 * 5. Clean up the old bot-only user + profile if no other platform accounts reference it
 * 6. Mark the token as used and notify the user back on chat
 */
export async function linkAccountToWeb(token: string): Promise<LinkResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to link your account." };
  }

  const webUserId = session.user.id;

  const tokenContext = await getLinkTokenContext(token);
  if (!tokenContext) {
    return { error: "Invalid or expired link token." };
  }

  const successResult = {
    success: true as const,
    platform: tokenContext.platform,
    platformUsername: tokenContext.platformUsername,
  };

  if (tokenContext.usedAt) {
    if (tokenContext.linkedUserId === webUserId) {
      return successResult;
    }

    await notifyPlatformUser(
      tokenContext.platform,
      tokenContext.platformUserId,
      buildFailureMessage("This link has already been used."),
    );

    return { error: "This link has already been used." };
  }

  if (tokenContext.expiresAt.getTime() <= Date.now()) {
    await db
      .update(accountLinkTokens)
      .set({ status: "expired" })
      .where(eq(accountLinkTokens.id, tokenContext.tokenId));

    await notifyPlatformUser(
      tokenContext.platform,
      tokenContext.platformUserId,
      buildFailureMessage("This link has expired. Please ask me for a new link and try again."),
    );

    return { error: "This link has expired. Please request a new one from the bot." };
  }

  if (tokenContext.linkedUserId === webUserId) {
    await db
      .update(accountLinkTokens)
      .set({ status: "used", usedAt: new Date() })
      .where(eq(accountLinkTokens.id, tokenContext.tokenId));

    await notifyPlatformUser(
      tokenContext.platform,
      tokenContext.platformUserId,
      buildSuccessMessage(true),
    );

    return successResult;
  }

  try {
    await db.transaction(async (tx) => {
      const oldBotUserId = tokenContext.linkedUserId;

      await tx
        .update(platformAccounts)
        .set({ userId: webUserId })
        .where(eq(platformAccounts.id, tokenContext.platformAccountId));

      const webLimits = await tx
        .select({ nutrientId: userNutrientLimits.nutrientId })
        .from(userNutrientLimits)
        .where(eq(userNutrientLimits.userId, webUserId));

      const webNutrientIds = new Set(webLimits.map((limit) => limit.nutrientId));

      const botLimits = await tx
        .select()
        .from(userNutrientLimits)
        .where(eq(userNutrientLimits.userId, oldBotUserId));

      for (const limit of botLimits) {
        if (!webNutrientIds.has(limit.nutrientId)) {
          await tx
            .update(userNutrientLimits)
            .set({ userId: webUserId })
            .where(eq(userNutrientLimits.id, limit.id));
        }
      }

      await tx
        .update(consumptionLogs)
        .set({ userId: webUserId })
        .where(eq(consumptionLogs.userId, oldBotUserId));

      const [webProfile] = await tx.select().from(profiles).where(eq(profiles.id, webUserId));
      const [botProfile] = await tx.select().from(profiles).where(eq(profiles.id, oldBotUserId));

      if (webProfile && botProfile) {
        const updates: Record<string, string> = {};
        if (!webProfile.healthGoal && botProfile.healthGoal)
          updates.healthGoal = botProfile.healthGoal;
        if (!webProfile.clinicalNotes && botProfile.clinicalNotes) {
          updates.clinicalNotes = botProfile.clinicalNotes;
        }
        if (
          (!webProfile.displayName || webProfile.displayName === "User") &&
          botProfile.displayName &&
          botProfile.displayName !== "Bot User"
        ) {
          updates.displayName = botProfile.displayName;
        }

        if (Object.keys(updates).length > 0) {
          await tx.update(profiles).set(updates).where(eq(profiles.id, webUserId));
        }
      }

      const [otherAccounts] = await tx
        .select({ id: platformAccounts.id })
        .from(platformAccounts)
        .where(
          and(
            eq(platformAccounts.userId, oldBotUserId),
            ne(platformAccounts.id, tokenContext.platformAccountId),
          ),
        );

      if (!otherAccounts) {
        await tx.delete(profiles).where(eq(profiles.id, oldBotUserId));
        await tx.delete(user).where(eq(user.id, oldBotUserId));
      }

      await tx
        .update(accountLinkTokens)
        .set({ status: "used", usedAt: new Date() })
        .where(eq(accountLinkTokens.platformAccountId, tokenContext.platformAccountId));
    });
  } catch (error) {
    console.error("[LinkAccount] Failed to link account:", error);

    await notifyPlatformUser(
      tokenContext.platform,
      tokenContext.platformUserId,
      buildFailureMessage(
        "Something went wrong while linking your account. Please ask me for a new link and try again.",
      ),
    );

    return {
      error:
        "Something went wrong while linking your account. Please try again or request a new link from the bot.",
    };
  }

  await notifyPlatformUser(
    tokenContext.platform,
    tokenContext.platformUserId,
    buildSuccessMessage(false),
  );

  return successResult;
}

async function getLinkTokenContext(token: string): Promise<LinkTokenContext | null> {
  const [row] = await db
    .select({
      tokenId: accountLinkTokens.id,
      platformAccountId: accountLinkTokens.platformAccountId,
      expiresAt: accountLinkTokens.expiresAt,
      usedAt: accountLinkTokens.usedAt,
      linkedUserId: platformAccounts.userId,
      platform: platformAccounts.platform,
      platformUserId: platformAccounts.platformUserId,
      platformUsername: platformAccounts.platformUsername,
    })
    .from(accountLinkTokens)
    .innerJoin(platformAccounts, eq(platformAccounts.id, accountLinkTokens.platformAccountId))
    .where(eq(accountLinkTokens.token, token));

  return row ?? null;
}

function buildSuccessMessage(alreadyLinked: boolean): string {
  if (alreadyLinked) {
    return "Your account is already linked to this web account. Your data is already synced between the bot and dashboard.";
  }

  return "Your account has been linked. Your nutrient limits, meal logs, and profile are now synced with your web account. You can continue using the bot as usual.";
}

function buildFailureMessage(reason: string): string {
  return `Account linking failed: ${reason}`;
}

/**
 * Send a notification to the user's chat platform about the link result.
 * Best-effort — failures are silently ignored.
 */
async function notifyPlatformUser(platform: string, platformUserId: string, message: string) {
  try {
    const bot = getBot();
    const adapter = bot.getAdapter(platform as "telegram" | "discord" | "whatsapp");
    if (!adapter?.openDM) {
      throw new Error(`Adapter "${platform}" does not support direct messages.`);
    }

    const dmThreadId = await adapter.openDM(platformUserId);
    await adapter.postMessage(dmThreadId, message);
  } catch (error) {
    console.error("[LinkAccount] Failed to notify platform user:", error);
  }
}
