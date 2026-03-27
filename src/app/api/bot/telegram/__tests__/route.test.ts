import { afterEach, describe, expect, it, vi } from "vitest";

import { getBot } from "@/lib/bot";

import { POST } from "../route";

vi.mock("@/lib/bot", () => ({
  getBot: vi.fn(() => ({
    webhooks: {
      telegram: vi.fn(),
    },
  })),
}));

describe("Telegram webhook route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns bot webhook response on success", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    const mockBot = { webhooks: { telegram: vi.fn().mockResolvedValue(mockResponse) } };
    vi.mocked(getBot).mockReturnValue(mockBot as unknown as ReturnType<typeof getBot>);

    const request = new Request("http://localhost/api/bot/telegram", { method: "POST" });
    const result = await POST(request);

    expect(result).toBe(mockResponse);
  });

  it("returns 200 OK when webhook handler throws (prevents Telegram retry)", async () => {
    const mockBot = {
      webhooks: { telegram: vi.fn().mockRejectedValue(new Error("Internal error")) },
    };
    vi.mocked(getBot).mockReturnValue(mockBot as unknown as ReturnType<typeof getBot>);

    const request = new Request("http://localhost/api/bot/telegram", { method: "POST" });
    const result = await POST(request);

    expect(result.status).toBe(200);
    const body = await result.text();
    expect(body).toBe("OK");
  });
});
