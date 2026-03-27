import { getSession } from "@/lib/auth-session";

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}

/**
 * Verify the current user is an admin. Returns user ID if admin, null otherwise.
 */
export async function requireAdmin(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  return isAdminEmail(session.user.email) ? session.user.id : null;
}
