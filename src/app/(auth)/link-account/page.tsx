import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-session";

import { validateLinkToken } from "./actions";
import { LinkAccountCard } from "./link-account-card";

export default async function LinkAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  // Validate the token before rendering anything
  const validation = await validateLinkToken(token);

  if (!validation.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-2xl font-bold">Link Expired</h1>
          <p className="text-muted-foreground">{validation.error}</p>
        </div>
      </div>
    );
  }

  // Check if user is already signed in
  const session = await getSession();

  return (
    <LinkAccountCard
      token={token}
      platform={validation.platform}
      platformUsername={validation.platformUsername}
      isSignedIn={!!session}
      userName={session?.user?.name ?? null}
    />
  );
}
