import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { profiles } from "@/lib/db/schema/users";
import { createAdminClient } from "@/lib/supabase/admin";

type PlatformAccount = typeof platformAccounts.$inferSelect;

/**
 * Find an existing platform account or create a new one with linked Supabase auth user.
 *
 * When creating:
 * 1. Creates a Supabase auth user via admin client
 * 2. Creates a profiles row
 * 3. Creates a platform_accounts row with onboarding_state='new'
 */
export async function findOrCreatePlatformAccount(
  platform: "telegram" | "discord",
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

  // Create new Supabase auth user + profile + platform account
  try {
    const supabase = createAdminClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `${platform}_${platformUserId}@bot.nutribalance.local`,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message ?? "Unknown error"}`);
    }

    const userId = authData.user.id;
    const displayName = platformUsername ?? "Bot User";

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
    const isConstraintError = error instanceof Error && error.message.includes("unique constraint");
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
