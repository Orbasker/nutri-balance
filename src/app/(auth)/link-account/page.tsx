import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getSession } from "@/lib/auth-session";

import { LinkAccountCard } from "./link-account-card";
import { validateLinkToken } from "./validate-token";

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

  // Token was already consumed — show success instead of "expired"
  if (validation.alreadyUsed) {
    const platformLabel =
      validation.platform.charAt(0).toUpperCase() + validation.platform.slice(1);
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Account Linked</CardTitle>
            <CardDescription>
              Your {platformLabel} bot account ({validation.platformUsername ?? "your account"}) is
              now connected to your web account. All your data is synced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </a>
          </CardContent>
        </Card>
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
