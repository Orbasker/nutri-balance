import { bot } from "@/lib/bot";

export async function POST(request: Request): Promise<Response> {
  try {
    return await bot.webhooks.discord(request);
  } catch (error) {
    console.error("[NutriBalance Bot] Discord webhook error:", error);
    // Always return 200 to prevent Discord from retrying/deactivating webhook
    return new Response("OK", { status: 200 });
  }
}
