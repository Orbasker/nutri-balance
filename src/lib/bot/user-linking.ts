import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { platformAccounts } from "@/lib/db/schema/platform-accounts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PlatformAccount = typeof platformAccounts.$inferSelect;

/**
 * Find an existing platform account or create a new one with a linked auth user.
 *
 * When creating:
 * 1. Creates a user in Supabase Auth via admin API
 * 2. The handle_new_user trigger auto-creates the profile row
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

  // Create new auth user + platform account
  try {
    const displayName = platformUsername ?? "Bot User";
    const email = `${platform}_${platformUserId}@bot.nutribalance.local`;

    // Create user via Supabase Admin API (triggers handle_new_user for profile creation)
    const { data: authUser, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (authError || !authUser.user) {
      throw new Error(`Failed to create auth user: ${authError?.message ?? "unknown error"}`);
    }

    const userId = authUser.user.id;

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
