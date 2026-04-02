import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { profiles } from "@/lib/db/schema/users";

type PlatformAccount = typeof platformAccounts.$inferSelect;

/**
 * Find an existing platform account or create a new one with a linked auth user.
 *
 * When creating:
 * 1. Creates a user row in the better-auth user table
 * 2. Creates a profiles row
 * 3. Creates a platform_accounts row with onboarding_state='new'
 */
export async function findOrCreatePlatformAccount(
  platform: "telegram" | "discord" | "whatsapp",
  platformUserId: string,
  platformUsername: string | null,
): Promise<PlatformAccount> {
  // Check for existing account
  const existing = await db
    .select()
    .from(platformAccounts)
    .where(
      and(
        eq(platformAccounts.platform, platform),
        eq(platformAccounts.platformUserId, platformUserId),
      ),
    );

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new auth user + profile + platform account
  try {
    const userId = crypto.randomUUID();
    const displayName = platformUsername ?? "Bot User";
    const email = `${platform}_${platformUserId}@bot.nutribalance.local`;

    // Create auth user directly via Drizzle
    await db.insert(user).values({
      id: userId,
      name: displayName,
      email,
      emailVerified: true,
    });

    // Create profile
    await db.insert(profiles).values({
      id: userId,
      displayName,
    });

    // Create platform account
    const [account] = await db
      .insert(platformAccounts)
      .values({
        userId,
        platform,
        platformUserId,
        platformUsername,
      })
      .returning();

    return account;
  } catch (error) {
    // If it's a unique constraint error, the account was created by a concurrent request
    const isConstraintError = error instanceof Error && error.message.includes("unique");
    if (isConstraintError) {
      const [retryAccount] = await db
        .select()
        .from(platformAccounts)
        .where(
          and(
            eq(platformAccounts.platform, platform),
            eq(platformAccounts.platformUserId, platformUserId),
          ),
        );
      if (retryAccount) return retryAccount;
    }
    throw error;
  }
}
