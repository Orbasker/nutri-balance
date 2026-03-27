import { type NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

const protectedPaths = [
  "/dashboard",
  "/search",
  "/food",
  "/log",
  "/settings",
  "/review",
  "/chat",
  "/api/chat",
];
const authPaths = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are always accessible
  if (authPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  // Check for session cookie (optimistic check — full validation happens in layouts/actions)
  const sessionCookie = getSessionCookie(request);

  // Redirect unauthenticated users away from protected routes
  if (!sessionCookie && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
