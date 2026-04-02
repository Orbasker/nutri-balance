import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages are always accessible
  if (authPaths.some((p) => pathname.startsWith(p))) {
    const { response } = await updateSession(request);
    return response;
  }

  // Refresh Supabase session and check auth
  const { response, user } = await updateSession(request);

  // Redirect unauthenticated users away from protected routes
  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return Response.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|api/bot/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
