import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsEvent } from "@/lib/analytics";

describe("sanitizeAnalyticsEvent", () => {
  it("removes query strings and hashes from analytics URLs", () => {
    const event = sanitizeAnalyticsEvent({
      type: "pageview",
      url: "https://nutritionmasterbot.com/log?date=2026-04-03#daily-summary",
    });

    expect(event).toEqual({
      type: "pageview",
      url: "https://nutritionmasterbot.com/log",
    });
  });

  it("normalizes private route ids before sending analytics", () => {
    const event = sanitizeAnalyticsEvent({
      type: "pageview",
      url: "https://nutritionmasterbot.com/chat/session-123",
    });

    expect(event).toEqual({
      type: "pageview",
      url: "https://nutritionmasterbot.com/chat/[id]",
    });
  });

  it("normalizes food detail routes", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://nutritionmasterbot.com/food/food_123?source=search",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://nutritionmasterbot.com/food/[id]",
    });

    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://nutritionmasterbot.com/foods/food_123",
      }),
    ).toEqual({
      type: "pageview",
      url: "https://nutritionmasterbot.com/foods/[id]",
    });
  });

  it("leaves non-dynamic routes intact", () => {
    const event = sanitizeAnalyticsEvent({
      type: "pageview",
      url: "https://nutritionmasterbot.com/methodology",
    });

    expect(event).toEqual({
      type: "pageview",
      url: "https://nutritionmasterbot.com/methodology",
    });
  });
});
