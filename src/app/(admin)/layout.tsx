import Link from "next/link";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { AdminNav } from "@/components/admin/admin-nav";

import { getSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Admin</h1>
          <AdminNav />
        </div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Back to app
        </Link>
      </div>
      {children}
    </div>
  );
}
