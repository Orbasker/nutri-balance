"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-session";

export type AuthState = {
  error?: string;
} | null;

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function register(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = (formData.get("firstName") as string) || undefined;
  const lastName = (formData.get("lastName") as string) || undefined;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "User";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: displayName,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      },
      headers: await headers(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return { error: message };
  }

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await auth.api.signOut({
      headers: await headers(),
    });
  }
  redirect("/login");
}
