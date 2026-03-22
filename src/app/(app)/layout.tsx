import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { TopAppBar } from "@/components/layout/top-app-bar";

import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, display_name, avatar_color")
    .eq("id", user.id)
    .single();

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.display_name ||
    null;

  return (
    <div className="min-h-screen pb-24">
      <TopAppBar displayName={displayName} avatarColor={profile?.avatar_color ?? "blue"} />
      <main className="pt-20">{children}</main>
      <BottomNav />
    </div>
  );
}
