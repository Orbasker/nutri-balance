import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function sanitizeRedirectPath(path: string): string {
  // Prevent open redirects: only allow relative paths starting with /
  // Block protocol-relative URLs (//evil.com), data: URLs, etc.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes(":\\")) {
    return "/dashboard";
  }
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next") ?? "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
