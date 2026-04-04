import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-[family-name:var(--font-inter)] text-neutral-800">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-neutral-500">Last updated: April 2, 2025</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Service Description</h2>
          <p>
            NutriBalance is a free nutrition tracking tool designed for individuals with medical or
            dietary constraints. It helps you monitor daily substance intake, check if foods are
            safe to eat based on your personal limits, and log meals — via web or messaging bots
            (Telegram, Discord, WhatsApp).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">No Medical Advice</h2>
          <p>
            NutriBalance is an informational tool, not a medical service. The substance data,
            AI-generated food analysis, and dietary suggestions provided are for reference only and
            should not replace professional medical advice. Always consult your healthcare provider
            regarding dietary decisions related to medical conditions.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">User Responsibilities</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              You are responsible for the accuracy of the substance limits and health goals you set.
            </li>
            <li>You agree to use the service for personal, non-commercial purposes.</li>
            <li>
              You will not attempt to abuse, overload, or interfere with the service or its
              infrastructure.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">AI-Generated Content</h2>
          <p>
            NutriBalance uses AI models to research foods and provide dietary analysis. AI-generated
            substance data is approximate and may contain inaccuracies. All AI-researched foods are
            clearly marked as estimates. Verified data from sources like the USDA database is
            preferred when available.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Availability and Cost</h2>
          <p>
            NutriBalance is provided free of charge. The service is offered as-is with no guarantees
            of uptime or availability. We reserve the right to modify or discontinue the service at
            any time.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Limitation of Liability</h2>
          <p>
            NutriBalance and its creators are not liable for any health outcomes, dietary decisions,
            or damages arising from use of the service. Use at your own discretion.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
            <a href="mailto:support@nutritionmasterbot.com" className="text-blue-600 underline">
              support@nutritionmasterbot.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
