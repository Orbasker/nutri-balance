import { redirect } from "next/navigation";

import { isAdminEmail } from "@/lib/auth-admin";
import { getSession } from "@/lib/auth-session";

export default async function AdminEntryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  redirect("/ai-observations");
}
