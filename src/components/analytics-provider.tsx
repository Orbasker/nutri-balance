"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { sanitizeAnalyticsEvent } from "@/lib/analytics";

export function AnalyticsProvider() {
  return (
    <>
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
      <SpeedInsights />
    </>
  );
}
