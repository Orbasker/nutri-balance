import { headers } from "next/headers";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

// Auth: 5 attempts per 60 seconds per IP (strict for brute-force protection)
const authLimiter = (() => {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "rl:auth",
  });
})();

// Chat: 20 requests per 60 seconds per user
const chatLimiter = (() => {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "rl:chat",
  });
})();

// Cron: 10 requests per 60 seconds per IP (already auth-gated, this prevents replay)
const cronLimiter = (() => {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "rl:cron",
  });
})();

async function getClientIp(): Promise<string> {
  const h = await headers();
  // Use x-vercel-forwarded-for first (Vercel-set, cannot be spoofed)
  // Fall back to x-forwarded-for for other environments
  const ip =
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return ip;
}

type RateLimitResult = { limited: false } | { limited: true; reset: number; retryAfter: number };

async function checkLimit(limiter: Ratelimit | null, identifier: string): Promise<RateLimitResult> {
  if (!limiter) return { limited: false };

  const { success, reset } = await limiter.limit(identifier);
  if (success) return { limited: false };

  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return { limited: true, reset, retryAfter };
}

/**
 * Rate limit auth actions (login/register) by IP.
 * Returns null if allowed, or an error message string if rate limited.
 */
export async function checkAuthRateLimit(): Promise<string | null> {
  const ip = await getClientIp();
  const result = await checkLimit(authLimiter, ip);
  if (result.limited) {
    return "Too many attempts. Please try again later.";
  }
  return null;
}

/**
 * Rate limit chat API by user ID.
 * Returns a RateLimitResult: { limited: false } or { limited: true, reset, retryAfter }.
 */
export function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(chatLimiter, userId);
}

/**
 * Rate limit cron endpoints by IP.
 * Returns a RateLimitResult: { limited: false } or { limited: true, reset, retryAfter }.
 */
export async function checkCronRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIp();
  return checkLimit(cronLimiter, ip);
}
