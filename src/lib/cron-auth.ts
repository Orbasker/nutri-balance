import { NextResponse } from "next/server";

import { timingSafeEqual } from "crypto";

/**
 * Validates CRON_SECRET bearer token using timing-safe comparison.
 * Returns a 401 response if invalid, or null if valid.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * Sanitizes error for external response — logs full error server-side,
 * returns only a generic message to the client.
 */
export function handleCronError(
  label: string,
  error: unknown,
): { message: string; logged: string } {
  const logged = error instanceof Error ? error.message : String(error);
  console.error(`[CRON] ${label} failed:`, error);
  return { message: `${label} failed`, logged };
}
