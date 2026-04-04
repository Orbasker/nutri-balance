import type { DiscordAdapter } from "@chat-adapter/discord";
import { after } from "next/server";

import { getBot } from "@/lib/bot";

export const maxDuration = 800;

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const discord = getBot().getAdapter("discord") as DiscordAdapter | undefined;
  if (!discord) {
    return new Response("Discord adapter not configured", { status: 500 });
  }

  const host = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "");
  const webhookUrl = host ? `https://${host}/api/bot/discord` : undefined;

  const durationMs = 600_000; // 10 minutes

  return discord.startGatewayListener(
    { waitUntil: (task: Promise<unknown>) => after(() => task) },
    durationMs,
    undefined,
    webhookUrl,
  );
}
