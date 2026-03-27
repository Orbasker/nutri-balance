"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { authClient } from "@/lib/auth-client";

import { GoogleButton } from "../google-button";
import { linkAccountToWeb } from "./actions";

export function LinkAccountCard({
  token,
  platform,
  platformUsername,
  isSignedIn,
  userName,
}: {
  token: string;
  platform: string;
  platformUsername: string | null;
  isSignedIn: boolean;
  userName: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "linking" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const displayName = platformUsername ?? "your account";

  async function handleLink() {
    setStatus("linking");
    setError(null);

    const result = await linkAccountToWeb(token);
    if ("error" in result) {
      setError(result.error);
      setStatus("error");
    } else {
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Account Linked</CardTitle>
            <CardDescription>
              Your {platformLabel} bot account ({displayName}) is now connected to your web account.
              All your data is synced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Link Your Account</CardTitle>
          <CardDescription>
            Connect your {platformLabel} bot account ({displayName}) to your NutriBalance web
            account. Your nutrient limits, meal logs, and profile will be merged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {isSignedIn ? (
            <div className="flex flex-col gap-4">
              <p className="text-center text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{userName}</span>
              </p>
              <Button className="w-full" onClick={handleLink} disabled={status === "linking"}>
                {status === "linking" ? "Linking..." : `Link ${platformLabel} Account`}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-center text-sm text-muted-foreground">
                Sign in to your web account to complete the link.
              </p>
              <GoogleButton callbackURL={`/link-account?token=${token}`} />
              <div className="relative flex items-center">
                <Separator className="flex-1" />
                <span className="px-3 text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/login?callbackUrl=/link-account?token=${token}`)}
              >
                Sign in with email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
