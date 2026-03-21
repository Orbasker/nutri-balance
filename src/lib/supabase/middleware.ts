import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

const protectedPaths = ["/dashboard", "/search", "/food", "/log", "/settings", "/review"];
const authPaths = ["/login", "/register"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are always accessible — never redirect from them in the proxy.
  // The login/register pages handle their own redirect-if-authenticated logic.
  if (authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
