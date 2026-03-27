import { eq } from "drizzle-orm";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

/**
 * Verify the current user is an admin. Returns user ID if admin, null otherwise.
 */
export async function requireAdmin(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  return profile?.role === "admin" ? session.user.id : null;
}
