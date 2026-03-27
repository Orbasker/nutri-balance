import { headers } from "next/headers";

import { type Session, auth } from "@/lib/auth";

/**
 * Get the current session in server components and server actions.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
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
