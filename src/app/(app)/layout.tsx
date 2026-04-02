import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { AppNav } from "@/components/layout/bottom-nav";
import { TopAppBar } from "@/components/layout/top-app-bar";

import { isAdminEmail } from "@/lib/auth-admin";
import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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
  const showAdminLink = isAdminEmail(session.user.email);

  return (
    <AppShell>
      <div className="min-h-screen pb-24 md:pb-0 md:pl-64">
        <TopAppBar
          displayName={displayName}
          greeting={getGreeting()}
          showAdminLink={showAdminLink}
          avatarColor={profile?.avatarColor ?? "blue"}
        />
        <main className="pt-20">{children}</main>
        <AppNav />
      </div>
    </AppShell>
  );
}
