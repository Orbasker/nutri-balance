import { describe, expect, it, vi } from "vitest";

const mockDiscordWebhook = vi.fn();

vi.mock("@/lib/bot", () => ({
  bot: {
    webhooks: {
      discord: mockDiscordWebhook,
    },
  },
}));

describe("Discord webhook route", () => {
  it("delegates POST to bot.webhooks.discord", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    mockDiscordWebhook.mockResolvedValue(mockResponse);

    const { POST } = await import("../route");
    const request = new Request("https://example.com/api/bot/discord", {
      method: "POST",
      body: JSON.stringify({ test: true }),
    });

    const response = await POST(request);
    expect(mockDiscordWebhook).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("returns 200 on webhook error to prevent retries", async () => {
    mockDiscordWebhook.mockRejectedValue(new Error("Discord API error"));

    const { POST } = await import("../route");
    const request = new Request("https://example.com/api/bot/discord", {
      method: "POST",
      body: JSON.stringify({ test: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
