"use client";

import { useActionState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { type AuthState, register } from "../actions";
import { GoogleButton } from "../google-button";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(register, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Get started with NutriBalance</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </label>
                <Input id="firstName" name="firstName" autoComplete="given-name" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </label>
                <Input id="lastName" name="lastName" autoComplete="family-name" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="relative my-4 flex items-center">
            <Separator className="flex-1" />
            <span className="px-3 text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
