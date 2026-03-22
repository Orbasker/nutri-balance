"use client";

import { useTransition } from "react";

import { logout } from "@/app/(auth)/actions";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
    >
      <span className="material-symbols-outlined text-[20px] mr-2">logout</span>
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
