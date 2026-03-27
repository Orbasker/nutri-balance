import { afterEach, describe, expect, it, vi } from "vitest";

import { bot } from "@/lib/bot";

import { POST } from "../route";

vi.mock("@/lib/bot", () => ({
  bot: {
    webhooks: {
      telegram: vi.fn(),
    },
  },
}));

describe("Telegram webhook route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns bot webhook response on success", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    vi.mocked(bot.webhooks.telegram).mockResolvedValue(mockResponse);

    const request = new Request("http://localhost/api/bot/telegram", { method: "POST" });
    const result = await POST(request);

    expect(result).toBe(mockResponse);
  });

  it("returns 200 OK when webhook handler throws (prevents Telegram retry)", async () => {
    vi.mocked(bot.webhooks.telegram).mockRejectedValue(new Error("Internal error"));

    const request = new Request("http://localhost/api/bot/telegram", { method: "POST" });
    const result = await POST(request);

    expect(result.status).toBe(200);
    const body = await result.text();
    expect(body).toBe("OK");
  });
});
