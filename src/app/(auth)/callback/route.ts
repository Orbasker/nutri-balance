import { NextResponse } from "next/server";

// Auth callback — implemented in Phase 2
export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
