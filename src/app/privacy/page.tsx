import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — NutriBalance",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-[family-name:var(--font-inter)] text-neutral-800">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-neutral-500">Last updated: April 3, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold">What is NutriBalance?</h2>
          <p>
            NutriBalance is a free, personal nutrition tracking service that helps people with
            medical or dietary constraints monitor their daily substance intake. It is available as
            a web application and through messaging platforms (Telegram, Discord, WhatsApp).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Information We Collect</h2>
          <p>
            When you use NutriBalance, we collect only what is necessary to provide the service:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Account information</strong> — your name, email address, and authentication
              credentials (email/password or Google OAuth).
            </li>
            <li>
              <strong>Health and nutrition data</strong> — dietary constraints, substance limits,
              food consumption logs, and health goals you provide.
            </li>
            <li>
              <strong>Messaging platform identifiers</strong> — when you use NutriBalance through
              Telegram, Discord, or WhatsApp, we store your platform user ID to link your
              conversations to your account.
            </li>
            <li>
              <strong>Usage analytics</strong> — aggregate page-view analytics collected through
              Vercel Web Analytics. We remove query parameters and replace dynamic route IDs before
              those URLs are sent.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">How We Use Your Information</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>To track your substance intake and provide personalized dietary guidance.</li>
            <li>To sync your data across web and messaging platforms.</li>
            <li>
              To generate AI-powered food analysis using third-party AI providers (your messages are
              sent to the AI model to generate responses; no data is stored by AI providers beyond
              the request).
            </li>
            <li>
              To measure feature usage and site performance using privacy-conscious, aggregated page
              analytics.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Data Storage and Security</h2>
          <p>
            Your data is stored in a secured PostgreSQL database. All connections use TLS
            encryption. We do not sell, share, or distribute your personal or health data to third
            parties.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Third-Party Services</h2>
          <p>NutriBalance uses the following third-party services:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Vercel</strong> — hosting and serverless infrastructure.
            </li>
            <li>
              <strong>Vercel Web Analytics</strong> — aggregate traffic and page-view analytics with
              sanitized URLs.
            </li>
            <li>
              <strong>AI providers</strong> (via Vercel AI Gateway) — for food analysis and
              conversational responses. Messages are processed but not retained by providers.
            </li>
            <li>
              <strong>Messaging platforms</strong> (Telegram, Discord, WhatsApp) — for delivering
              bot messages. Subject to each platform&apos;s own privacy policy.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Data Retention and Deletion</h2>
          <p>
            You may request deletion of your account and all associated data at any time by
            contacting us. Upon deletion, all personal data, nutrition logs, and platform links are
            permanently removed.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Cost</h2>
          <p>
            NutriBalance is a free service. There are no subscription fees, in-app purchases, or
            hidden charges. The service is provided as-is for personal use.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Contact</h2>
          <p>
            For privacy inquiries or data deletion requests, contact us at{" "}
            <a href="mailto:privacy@nutritionmasterbot.com" className="text-blue-600 underline">
              privacy@nutritionmasterbot.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
