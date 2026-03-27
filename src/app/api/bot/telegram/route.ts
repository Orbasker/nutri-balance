import { getBot } from "@/lib/bot";

export async function POST(request: Request): Promise<Response> {
  try {
    return await getBot().webhooks.telegram(request);
  } catch (error) {
    console.error("[NutriBalance Bot] Telegram webhook error:", error);
    // Always return 200 to prevent Telegram from retrying/deactivating webhook
    return new Response("OK", { status: 200 });
  }
}
