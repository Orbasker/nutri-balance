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

  return (
    <div className="min-h-screen pb-24">
      <TopAppBar />
      <main className="pt-20">{children}</main>
      <BottomNav />
    </div>
  );
}
