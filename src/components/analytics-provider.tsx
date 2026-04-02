"use client";

import { Analytics } from "@vercel/analytics/next";

import { sanitizeAnalyticsEvent } from "@/lib/analytics";

export function AnalyticsProvider() {
  return <Analytics beforeSend={sanitizeAnalyticsEvent} />;
}
