import { getBot } from "@/lib/bot";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    return await getBot().webhooks.discord(request);
  } catch (error) {
    console.error("[NutriBalance Bot] Discord webhook error:", error);
    // Always return 200 to prevent Discord from retrying/deactivating webhook
    return new Response("OK", { status: 200 });
  }
}
