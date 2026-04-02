import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Data Methodology — NutriBalance",
  description:
    "Learn how NutriBalance sources, verifies, and scores nutritional data to give you reliable substance tracking.",
};

const SOURCE_TYPES = [
  {
    icon: "verified",
    title: "Government Databases",
    tag: "Highest trust",
    description:
      "Primary data from USDA FoodData Central, national food composition databases, and peer-reviewed government nutrition references. These are the gold standard for nutritional values.",
    trustRange: "90–100",
  },
  {
    icon: "science",
    title: "Scientific Literature",
    tag: "High trust",
    description:
      "Published research papers, clinical studies, and meta-analyses on substance retention, bioavailability, and food composition. Used especially for cooking-method adjustments.",
    trustRange: "80–95",
  },
  {
    icon: "factory",
    title: "Industry Data",
    tag: "Moderate trust",
    description:
      "Manufacturer-provided nutritional labels and industry food composition databases. Cross-referenced with other sources where possible.",
    trustRange: "60–80",
  },
  {
    icon: "auto_awesome",
    title: "AI-Researched",
    tag: "Review required",
    description:
      "When data is missing from primary sources, our AI agent researches scientific and government databases to fill gaps. All AI-extracted values are flagged for human review before being fully trusted.",
    trustRange: "40–85",
  },
];

const CONFIDENCE_LEVELS = [
  {
    label: "High",
    range: "90–100%",
    dots: 3,
    description: "Directly from government databases or verified analytical data.",
    color: "bg-emerald-500",
  },
  {
    label: "Good",
    range: "80–89%",
    dots: 3,
    description: "Strong scientific evidence with minor estimation involved.",
    color: "bg-blue-500",
  },
  {
    label: "Moderate",
    range: "60–79%",
    dots: 2,
    description:
      "Reasonable estimates from related foods, AI research, or calculated from components.",
    color: "bg-amber-500",
  },
  {
    label: "Low",
    range: "Below 60%",
    dots: 1,
    description:
      "Limited data available. Values are rough estimates and should not be used for critical medical decisions.",
    color: "bg-red-400",
  },
];

const DERIVATION_TYPES = [
  {
    type: "Analytical",
    icon: "biotech",
    description: "Measured in a laboratory from actual food samples.",
  },
  {
    type: "Calculated",
    icon: "calculate",
    description: "Computed from known ingredient compositions using standardized formulas.",
  },
  {
    type: "Estimated",
    icon: "trending_flat",
    description: "Inferred from similar foods or related entries in reference databases.",
  },
  {
    type: "Imputed",
    icon: "auto_fix_high",
    description: "Filled from a closely related food when no direct data exists.",
  },
  {
    type: "AI-Extracted",
    icon: "auto_awesome",
    description:
      "Researched by our AI agent from scientific sources. Always marked for human review.",
  },
];

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-md-on-surface">
      {/* Header */}
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1 text-md-primary hover:opacity-80 transition-opacity"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        <span className="text-sm font-medium">Back</span>
      </Link>

      <h1 className="mb-3 font-heading text-3xl font-extrabold tracking-tight text-md-primary">
        How Our Data Works
      </h1>
      <p className="mb-12 text-md-on-surface-variant leading-relaxed">
        Transparency is core to NutriBalance. When you make dietary decisions based on our data, you
        deserve to know exactly where it comes from, how confident we are, and what review process
        it went through.
      </p>

      {/* Data Pipeline Overview */}
      <section className="mb-14">
        <h2 className="mb-6 text-xl font-bold">The Data Pipeline</h2>
        <div className="relative space-y-0">
          {[
            {
              step: "1",
              title: "Source",
              description:
                "Data is imported from government databases, scientific papers, or researched by AI.",
              icon: "download",
            },
            {
              step: "2",
              title: "Observe",
              description:
                "Each value becomes a substance observation — tagged with its source, derivation method, and initial confidence score.",
              icon: "visibility",
            },
            {
              step: "3",
              title: "Evidence",
              description:
                "Observations link to evidence items: page references, row locators, URLs, and text snippets from original sources.",
              icon: "link",
            },
            {
              step: "4",
              title: "Review",
              description:
                "AI-generated and low-confidence observations go through human review. Reviewers can approve, reject, or request revision.",
              icon: "rate_review",
            },
            {
              step: "5",
              title: "Resolve",
              description:
                "Approved observations become resolved values — the trusted numbers you see on food pages, with a final confidence score and source summary.",
              icon: "check_circle",
            },
          ].map((item, i) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-md-primary text-white text-sm font-bold">
                  {item.step}
                </div>
                {i < 4 && <div className="w-px flex-1 bg-md-outline-variant/40 my-1" />}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-md-primary text-[20px]">
                    {item.icon}
                  </span>
                  <h3 className="font-bold text-md-on-surface">{item.title}</h3>
                </div>
                <p className="text-sm text-md-on-surface-variant leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Source Types */}
      <section className="mb-14">
        <h2 className="mb-6 text-xl font-bold">Where Data Comes From</h2>
        <div className="space-y-4">
          {SOURCE_TYPES.map((source) => (
            <div key={source.title} className="rounded-2xl bg-md-surface-container-low p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-md-primary-fixed">
                  <span className="material-symbols-outlined text-[20px] text-md-on-primary-fixed-variant">
                    {source.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-md-on-surface">{source.title}</h3>
                    <span className="rounded-full bg-md-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-md-on-surface-variant">
                      {source.tag}
                    </span>
                  </div>
                  <p className="text-sm text-md-on-surface-variant leading-relaxed">
                    {source.description}
                  </p>
                  <p className="mt-2 text-xs text-md-outline">Trust level: {source.trustRange}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Confidence Scores */}
      <section className="mb-14">
        <h2 className="mb-3 text-xl font-bold">Confidence Scores</h2>
        <p className="mb-6 text-sm text-md-on-surface-variant leading-relaxed">
          Every substance value has a confidence score from 0 to 100. This tells you how reliable
          the data point is. On food pages, you see the average confidence across all tracked
          substances.
        </p>
        <div className="space-y-3">
          {CONFIDENCE_LEVELS.map((level) => (
            <div
              key={level.label}
              className="flex items-start gap-4 rounded-xl bg-md-surface-container-low px-5 py-4"
            >
              <div className="flex items-center gap-1 pt-0.5">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`block h-2.5 w-2.5 rounded-full ${
                      i <= level.dots ? level.color : "bg-md-outline-variant/40"
                    }`}
                  />
                ))}
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-md-on-surface">{level.label}</span>
                  <span className="text-xs text-md-outline">{level.range}</span>
                </div>
                <p className="mt-0.5 text-sm text-md-on-surface-variant">{level.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Derivation Types */}
      <section className="mb-14">
        <h2 className="mb-3 text-xl font-bold">How Values Are Derived</h2>
        <p className="mb-6 text-sm text-md-on-surface-variant leading-relaxed">
          Not all nutritional values come from the same method. Each substance observation is tagged
          with its derivation type so you know how the number was obtained.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DERIVATION_TYPES.map((d) => (
            <div key={d.type} className="rounded-xl bg-md-surface-container-low p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-md-primary text-[18px]">
                  {d.icon}
                </span>
                <span className="font-bold text-sm text-md-on-surface">{d.type}</span>
              </div>
              <p className="text-xs text-md-on-surface-variant leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Review Process */}
      <section className="mb-14">
        <h2 className="mb-3 text-xl font-bold">The Review Process</h2>
        <p className="text-sm text-md-on-surface-variant leading-relaxed mb-4">
          Every substance value goes through a review cycle before becoming a trusted resolved
          value:
        </p>
        <div className="rounded-2xl bg-md-surface-container-low p-5 space-y-3">
          {[
            {
              status: "Pending",
              color: "bg-amber-400",
              text: "Newly imported or AI-researched. Awaiting review.",
            },
            {
              status: "Approved",
              color: "bg-emerald-500",
              text: "Verified by a reviewer. This value is trusted.",
            },
            {
              status: "Needs Revision",
              color: "bg-blue-400",
              text: "Flagged for correction. The value may be inaccurate.",
            },
            {
              status: "Rejected",
              color: "bg-red-400",
              text: "Deemed unreliable. Will not appear in resolved values.",
            },
          ].map((item) => (
            <div key={item.status} className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
              <div>
                <span className="font-semibold text-sm text-md-on-surface">{item.status}</span>
                <span className="text-sm text-md-on-surface-variant"> — {item.text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Feedback */}
      <section className="mb-14">
        <h2 className="mb-3 text-xl font-bold">Your Feedback Matters</h2>
        <p className="text-sm text-md-on-surface-variant leading-relaxed">
          On every food page, you can flag inaccurate data or suggest corrections. Each submission
          links to the specific substance and variant, and our reviewers investigate every report.
          If you have a source URL or research to back up your correction, even better.
        </p>
      </section>

      {/* Footer link */}
      <div className="border-t border-md-outline-variant/30 pt-8 text-center">
        <p className="text-sm text-md-on-surface-variant mb-4">
          Questions about our data? Found something inaccurate?
        </p>
        <Link
          href="/register"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
        >
          Create an account and report it
        </Link>
      </div>
    </main>
  );
}
