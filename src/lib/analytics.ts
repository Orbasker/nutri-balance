import type { BeforeSendEvent } from "@vercel/analytics/next";

const DYNAMIC_ROUTE_REPLACEMENTS = [
  { pattern: /^\/chat\/[^/]+$/, replacement: "/chat/[id]" },
  { pattern: /^\/food\/[^/]+$/, replacement: "/food/[id]" },
  { pattern: /^\/foods\/[^/]+$/, replacement: "/foods/[id]" },
] as const;

export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);

    url.search = "";
    url.hash = "";

    for (const route of DYNAMIC_ROUTE_REPLACEMENTS) {
      if (route.pattern.test(url.pathname)) {
        url.pathname = route.replacement;
        break;
      }
    }

    return {
      ...event,
      url: url.toString(),
    };
  } catch {
    return event;
  }
}
