import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopAppBar } from "@/components/layout/top-app-bar";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [profile] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      displayName: profiles.displayName,
      avatarColor: profiles.avatarColor,
    })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.displayName ||
    session.user.name ||
    null;

  return (
    <AppShell>
      <div className="min-h-screen pb-24">
        <TopAppBar displayName={displayName} avatarColor={profile?.avatarColor ?? "blue"} />
        <main className="pt-20">{children}</main>
        <BottomNav />
      </div>
    </AppShell>
  );
}
