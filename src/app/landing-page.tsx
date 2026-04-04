"use client";

import Link from "next/link";

export function LandingPage() {
  return (
    <>
      <div className="flex min-h-screen flex-col">
        {/* Nav */}
        <header className="fixed top-0 z-40 w-full border-b border-md-outline-variant/20 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-md-primary">
              NutriBalance
            </h1>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1">
          <section className="relative overflow-hidden px-6 pb-20 pt-32">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-md-primary-fixed/20 to-transparent" />
            <div className="relative mx-auto max-w-screen-md text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-md-primary-fixed/40 px-4 py-1.5 text-sm font-medium text-md-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">vital_signs</span>
                Medical-grade substance tracking
              </div>
              <h2 className="mb-6 font-heading text-4xl font-extrabold leading-tight tracking-tight text-md-on-surface sm:text-5xl">
                Can I eat this today?
              </h2>
              <p className="mx-auto mb-10 max-w-lg text-lg text-md-on-surface-variant">
                Track substance intake against your medical limits. Get confidence scores, cooking
                adjustments, and clear answers — not guesswork.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
                >
                  Start tracking free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
                >
                  Log in
                </Link>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="px-6 py-20">
            <div className="mx-auto max-w-screen-lg">
              <h3 className="mb-12 text-center font-heading text-2xl font-extrabold tracking-tight text-md-on-surface">
                Built for people with dietary constraints
              </h3>
              <div className="grid gap-8 sm:grid-cols-3">
                <FeatureCard
                  icon="search"
                  title="Search any food"
                  description="Look up substances backed by real data sources. No AI-generated guesses."
                  href="/search"
                />
                <FeatureCard
                  icon="speed"
                  title="Confidence scores"
                  description="Know how reliable each substance value is before you make a decision."
                  href="/methodology"
                />
                <FeatureCard
                  icon="skillet"
                  title="Cooking adjustments"
                  description="See how boiling, frying, or baking changes substance retention."
                  href="/search"
                />
                <FeatureCard
                  icon="monitoring"
                  title="Daily tracking"
                  description="Log meals and watch your intake against personal medical limits."
                  href="/register"
                />
                <FeatureCard
                  icon="warning"
                  title="Clear thresholds"
                  description="Safe, caution, and exceed zones so you never have to guess."
                  href="/methodology"
                />
                <FeatureCard
                  icon="local_hospital"
                  title="Clinical notes"
                  description="Store your doctor's dietary instructions right alongside your data."
                  href="/register"
                />
              </div>
            </div>
          </section>

          {/* Data Transparency */}
          <section className="px-6 py-20 bg-md-surface-container-lowest">
            <div className="mx-auto max-w-screen-lg">
              <div className="text-center mb-12">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  Transparent by design
                </div>
                <h3 className="font-heading text-2xl font-extrabold tracking-tight text-md-on-surface mb-3">
                  Know where every number comes from
                </h3>
                <p className="mx-auto max-w-lg text-md-on-surface-variant">
                  Every substance value in NutriBalance is traceable to its source, scored for
                  confidence, and reviewed before you see it.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-3 mb-10">
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-md-outline-variant/10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <span className="material-symbols-outlined text-[20px] text-emerald-700">
                      database
                    </span>
                  </div>
                  <h4 className="mb-1 font-bold text-md-on-surface">Verified Sources</h4>
                  <p className="text-sm leading-relaxed text-md-on-surface-variant">
                    <a
                      href="https://fdc.nal.usda.gov/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-emerald-300 underline-offset-2 hover:text-emerald-700 transition-colors"
                    >
                      USDA FoodData Central
                    </a>
                    , scientific papers, and government nutrition databases — not AI guesses.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-md-outline-variant/10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <span className="material-symbols-outlined text-[20px] text-blue-700">
                      speed
                    </span>
                  </div>
                  <h4 className="mb-1 font-bold text-md-on-surface">Confidence Scores</h4>
                  <p className="text-sm leading-relaxed text-md-on-surface-variant">
                    Every value is scored 0–100. You see the confidence level on each food so you
                    know how much to trust it.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-md-outline-variant/10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                    <span className="material-symbols-outlined text-[20px] text-amber-700">
                      rate_review
                    </span>
                  </div>
                  <h4 className="mb-1 font-bold text-md-on-surface">Human Review</h4>
                  <p className="text-sm leading-relaxed text-md-on-surface-variant">
                    AI-researched data is flagged and goes through human review before becoming
                    trusted. Nothing slips through unchecked.
                  </p>
                </div>
              </div>

              {/* Pipeline mini-visual */}
              <div className="mx-auto max-w-screen-sm rounded-2xl bg-md-surface-container-low p-6">
                <div className="flex items-center justify-between gap-2 text-center">
                  {[
                    { icon: "download", label: "Import" },
                    { icon: "visibility", label: "Observe" },
                    { icon: "link", label: "Evidence" },
                    { icon: "rate_review", label: "Review" },
                    { icon: "check_circle", label: "Resolve" },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-md-primary-fixed">
                          <span className="material-symbols-outlined text-[18px] text-md-on-primary-fixed-variant">
                            {step.icon}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-md-on-surface-variant">
                          {step.label}
                        </span>
                      </div>
                      {i < 4 && (
                        <span className="material-symbols-outlined text-md-outline-variant text-[16px] mb-4">
                          chevron_right
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 text-center">
                <Link
                  href="/methodology"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-md-primary hover:opacity-80 transition-opacity"
                >
                  Read our full data methodology
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="px-6 py-20">
            <div className="glass-card mx-auto max-w-screen-sm rounded-3xl border border-md-outline-variant/20 p-10 text-center">
              <h3 className="mb-3 font-heading text-2xl font-extrabold tracking-tight text-md-on-surface">
                Take control of your nutrition
              </h3>
              <p className="mb-8 text-md-on-surface-variant">
                Free to use. Set up your limits in minutes.
              </p>
              <Link
                href="/register"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
              >
                Create your account
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-md-outline-variant/20 px-6 py-8">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between text-sm text-md-on-surface-variant">
            <span className="font-semibold text-md-primary">NutriBalance</span>
            <div className="flex items-center gap-4">
              <Link href="/search" className="hover:text-md-on-surface transition-colors">
                Search Foods
              </Link>
              <Link href="/methodology" className="hover:text-md-on-surface transition-colors">
                Our Data
              </Link>
              <Link href="/privacy" className="hover:text-md-on-surface transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-md-on-surface transition-colors">
                Terms
              </Link>
              <a
                href="https://t.me/nutri_balance_master_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-md-on-surface transition-colors"
              >
                Telegram Bot
              </a>
              <a
                href="https://discord.com/oauth2/authorize?client_id=1490013414997885080&scope=bot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-md-on-surface transition-colors"
              >
                Discord Bot
              </a>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-md-surface-container-low p-6 transition-shadow hover:shadow-md"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-md-primary-fixed">
        <span className="material-symbols-outlined text-[20px] text-md-on-primary-fixed-variant">
          {icon}
        </span>
      </div>
      <h4 className="mb-1 font-bold text-md-on-surface">{title}</h4>
      <p className="text-sm leading-relaxed text-md-on-surface-variant">{description}</p>
    </Link>
  );
}
