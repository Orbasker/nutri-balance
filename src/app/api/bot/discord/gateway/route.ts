import { after } from "next/server";

import type { DiscordAdapter } from "@chat-adapter/discord";

import { getBot } from "@/lib/bot";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 800;

export async function GET(request: Request): Promise<Response> {
  return POST(request);
}

export async function POST(request: Request): Promise<Response> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const discord = getBot().getAdapter("discord") as DiscordAdapter | undefined;
  if (!discord) {
    return new Response("Discord adapter not configured", { status: 500 });
  }

  const appUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/bot/discord`;

  const durationMs = 600_000; // 10 minutes

  return discord.startGatewayListener(
    { waitUntil: (task: Promise<unknown>) => after(() => task) },
    durationMs,
    undefined,
    webhookUrl,
  );
}
