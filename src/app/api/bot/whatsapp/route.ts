import { after } from "next/server";

import { getBot } from "@/lib/bot";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  try {
    return await getBot().webhooks.whatsapp(request);
  } catch (error) {
    console.error("[NutriBalance Bot] WhatsApp verification error:", error);
    return new Response("Verification failed", { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await getBot().webhooks.whatsapp(request, {
      waitUntil: (task) => after(() => task),
    });
  } catch (error) {
    console.error("[NutriBalance Bot] WhatsApp webhook error:", error);
    // Always return 200 to prevent Meta from retrying/deactivating webhook
    return new Response("OK", { status: 200 });
  }
}
