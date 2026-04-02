import type { Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the current session in server components and server actions.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email ?? "",
      image: user.user_metadata?.avatar_url ?? null,
    },
  };
}

/**
 * Get the current session, throwing if not authenticated.
 * Use in server actions that require authentication.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}
